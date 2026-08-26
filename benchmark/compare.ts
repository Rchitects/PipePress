/************************************
 *                                  *
 * THIS FILE WAS INITIALLY CREADED  *
 * VIA VIBE CODED AND IS ONLY       *
 * USED FOR CI AND DOES NOT HAVE    *
 * ANY INFLUENCE IN THE MOUDLE      *
 *                                  *
 ************************************/
/*** imports ***/
import { spawn, ChildProcess } from "child_process";
import autocannon from "autocannon";
import fs from "node:fs";
import path from "node:path";

/*** types ***/
type CliArgs = {
    current: string;      // path to PR-branch checkout (e.g. "pr-branch")
    baseline: string;      // path to main-branch checkout (e.g. "main-branch")
    threshold: number;      // allowed regression in percent (e.g. 10)
    rounds: number;      // number of interleaved rounds
    duration: number;      // autocannon duration per round in seconds
    connections: number;      // autocannon concurrent connections
    port: number;      // port both servers will run on (sequentially, never together)
    serverScript: string;      // relative path to compiled server entry, from repo root
    endpoint: string;      // route to hit
    outFile: string;      // where to write the markdown summary
};

type SingleRunResult = {
    rps: number;
    latencyAvg: number;
    latencyP50: number;
    latencyP99: number;
    errors: number;
    timeouts: number;
};

type AggregatedResult = {
    rps: number[];
    latencyAvg: number[];
    latencyP50: number[];
    latencyP99: number[];
    errors: number;
    timeouts: number;
};

type RegressionCheck = {
    label: string;
    baseMedian: number;
    curMedian: number;
    deltaPct: number;      // positive = current is worse
    regressed: boolean;
};

/*** cli parsing ***/
function parseArgs(): CliArgs {
    const argv = process.argv.slice(2);
    const get = (flag: string, fallback?: string): string | undefined => {
        const idx = argv.indexOf(flag);
        if (idx === -1) return fallback;
        return argv[idx + 1];
    };

    const current = get("--current");
    const baseline = get("--baseline");
    if (!current || !baseline) {
        console.error("Usage: compare.ts --current <dir> --baseline <dir> [--threshold 10] [--rounds 5] [--duration 10] [--connections 100] [--port 3004] [--server dist-benchmark/servers/pipepress.js] [--endpoint /echo] [--out benchmark-result.md]");
        process.exit(2);
    }

    return {
        current,
        baseline,
        threshold: Number(get("--threshold", "10")),
        rounds: Number(get("--rounds", "5")),
        duration: Number(get("--duration", "10")),
        connections: Number(get("--connections", "100")),
        port: Number(get("--port", "3004")),
        serverScript: get("--server", "dist-benchmark/servers/pipepress.js")!,
        endpoint: get("--endpoint", "/echo")!,
        outFile: get("--out", "benchmark-result.md")!,
    };
}

/*** helpers ***/
function sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
}

function median(values: number[]): number {
    if (values.length === 0) return NaN;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Waits until the server process signals readiness via IPC ('ready' message),
 * with a hard timeout as a safety net so a hung server can't stall CI forever.
 */
function waitForReady(proc: ChildProcess, timeoutMs: number = 15_000): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Server did not signal readiness within ${timeoutMs}ms`));
        }, timeoutMs);

        proc.once("message", () => {
            clearTimeout(timer);
            resolve();
        });

        proc.once("exit", (code) => {
            clearTimeout(timer);
            reject(new Error(`Server process exited early with code ${code}`));
        });

        proc.once("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

/**
 * Runs a single autocannon pass against a freshly spawned server process,
 * then kills it and waits briefly for the port to be released.
 */
async function runOnce(cwd: string, args: CliArgs): Promise<SingleRunResult> {
    const scriptPath = path.join(cwd, args.serverScript);
    if (!fs.existsSync(scriptPath)) {
        throw new Error(`Server script not found: ${scriptPath}`);
    }

    const proc = spawn("node", [scriptPath], {
        stdio: ["inherit", "inherit", "inherit", "ipc"],
        env: { ...process.env, PORT: String(args.port) },
    });

    try {
        await waitForReady(proc);

        const result = await autocannon({
            url: `http://localhost:${args.port}${args.endpoint}`,
            connections: args.connections,
            duration: args.duration,
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "R" }),
        });

        return {
            rps: result.requests.average,
            latencyAvg: result.latency.average,
            latencyP50: result.latency.p50,
            latencyP99: result.latency.p99,
            errors: result.errors,
            timeouts: result.timeouts,
        };
    }
    finally {
        proc.kill();
        // give the OS a moment to release the port before the next spawn
        await sleep(500);
    }
}

/**
 * Runs `rounds` passes for a single target. Kept separate from interleaving
 * logic so each round is fully isolated (fresh process, fresh port bind).
 */
async function runMultiple(cwd: string, args: CliArgs, rounds: number): Promise<AggregatedResult> {
    const agg: AggregatedResult = {
        rps: [], latencyAvg: [], latencyP50: [], latencyP99: [], errors: 0, timeouts: 0,
    };

    for (let i = 0; i < rounds; i++) {
        const r = await runOnce(cwd, args);
        agg.rps.push(r.rps);
        agg.latencyAvg.push(r.latencyAvg);
        agg.latencyP50.push(r.latencyP50);
        agg.latencyP99.push(r.latencyP99);
        agg.errors += r.errors;
        agg.timeouts += r.timeouts;
    }

    return agg;
}

/**
 * Interleaves current vs baseline runs (current, baseline, current, baseline, ...)
 * instead of running all of one then all of the other. This spreads systematic
 * noise (thermal throttling, noisy neighbors on shared CI runners) evenly across
 * both series instead of biasing one of them.
 */
async function runInterleaved(args: CliArgs): Promise<{ current: AggregatedResult; baseline: AggregatedResult }> {
    const current: AggregatedResult = { rps: [], latencyAvg: [], latencyP50: [], latencyP99: [], errors: 0, timeouts: 0 };
    const baseline: AggregatedResult = { rps: [], latencyAvg: [], latencyP50: [], latencyP99: [], errors: 0, timeouts: 0 };

    for (let round = 0; round < args.rounds; round++) {
        console.log(`\n▶ Round ${round + 1}/${args.rounds}`);

        console.log("  running current (PR branch)...");
        const curRun = await runOnce(args.current, args);
        current.rps.push(curRun.rps);
        current.latencyAvg.push(curRun.latencyAvg);
        current.latencyP50.push(curRun.latencyP50);
        current.latencyP99.push(curRun.latencyP99);
        current.errors += curRun.errors;
        current.timeouts += curRun.timeouts;

        console.log("  running baseline (main)...");
        const baseRun = await runOnce(args.baseline, args);
        baseline.rps.push(baseRun.rps);
        baseline.latencyAvg.push(baseRun.latencyAvg);
        baseline.latencyP50.push(baseRun.latencyP50);
        baseline.latencyP99.push(baseRun.latencyP99);
        baseline.errors += baseRun.errors;
        baseline.timeouts += baseRun.timeouts;
    }

    return { current, baseline };
}

/**
 * Compares two series using their medians.
 * `higherIsBetter=true`  -> regression when current median drops by more than thresholdPct (e.g. RPS)
 * `higherIsBetter=false` -> regression when current median rises by more than thresholdPct (e.g. latency)
 */
function checkRegression(
    label: string,
    baselineValues: number[],
    currentValues: number[],
    thresholdPct: number,
    higherIsBetter: boolean
): RegressionCheck {
    const baseMedian = median(baselineValues);
    const curMedian = median(currentValues);

    const rawDeltaPct = ((curMedian - baseMedian) / baseMedian) * 100;
    // normalize so "deltaPct > 0" always means "worse", regardless of metric direction
    const deltaPct = higherIsBetter ? -rawDeltaPct : rawDeltaPct;

    return {
        label,
        baseMedian,
        curMedian,
        deltaPct,
        regressed: deltaPct > thresholdPct,
    };
}

/*** output ***/
function fmt(n: number, digits: number = 2): string {
    return Number.isFinite(n) ? n.toFixed(digits) : "n/a";
}

function statusEmoji(check: RegressionCheck): string {
    if (check.regressed) return "❌";
    if (check.deltaPct > 0) return "⚠️"; // worse, but within threshold
    return "✅";
}

function writeComparisonSummary(checks: RegressionCheck[], args: CliArgs, errors: { current: number; baseline: number }): void {
    const anyRegressed = checks.some((c) => c.regressed);

    const rows = checks.map((c) =>
        `| ${c.label} | ${fmt(c.baseMedian)} | ${fmt(c.curMedian)} | ${c.deltaPct >= 0 ? "+" : ""}${fmt(c.deltaPct, 1)}% | ${statusEmoji(c)} |`
    ).join("\n");

    const md = `## 📊 Benchmark Comparison (PR vs \`main\`)

Threshold: **${args.threshold}%** allowed regression · ${args.rounds} interleaved rounds · ${args.duration}s each · ${args.connections} connections

| Metric | main (median) | PR (median) | Δ | Status |
|---|---|---|---|---|
${rows}

${errors.current > 0 || errors.baseline > 0 ? `⚠️ Errors during run — current: ${errors.current}, baseline: ${errors.baseline}\n\n` : ""}${anyRegressed
            ? "### ❌ Regression detected\nOne or more metrics regressed beyond the allowed threshold."
            : "### ✅ No regression detected"
        }
`;

    fs.writeFileSync(args.outFile, md, "utf-8");
    console.log("\n" + md);
}

function writeAbsoluteSummary(result: AggregatedResult, args: CliArgs, reason: string): void {
    const md = `## 📊 Benchmark (no baseline available)

> ${reason}

| Metric | Median |
|---|---|
| RPS | ${fmt(median(result.rps))} |
| Latency (avg) | ${fmt(median(result.latencyAvg))} ms |
| Latency (p50) | ${fmt(median(result.latencyP50))} ms |
| Latency (p99) | ${fmt(median(result.latencyP99))} ms |

No comparison was performed — nothing to fail against.
`;

    fs.writeFileSync(args.outFile, md, "utf-8");
    console.log("\n" + md);
}

/*** main ***/
async function main() {
    const args = parseArgs();

    const baselineScriptPath = path.join(args.baseline, args.serverScript);
    if (!fs.existsSync(baselineScriptPath)) {
        console.log(`⚠️ No baseline build found at ${baselineScriptPath}. Skipping comparison (likely the first benchmark-enabled PR).`);

        const result = await runMultiple(args.current, args, args.rounds);
        writeAbsoluteSummary(result, args, `Baseline build missing at ${baselineScriptPath} — nothing to compare against.`);
        process.exit(0); // do not fail the very first run
    }

    console.log(`Comparing ${args.current} against ${args.baseline}`);
    console.log(`${args.rounds} interleaved rounds, ${args.duration}s each, ${args.connections} connections\n`);

    const { current, baseline } = await runInterleaved(args);

    const checks: RegressionCheck[] = [
        checkRegression("Requests/sec", baseline.rps, current.rps, args.threshold, true),
        checkRegression("Latency (avg)", baseline.latencyAvg, current.latencyAvg, args.threshold, false),
        checkRegression("Latency (p50)", baseline.latencyP50, current.latencyP50, args.threshold, false),
        checkRegression("Latency (p99)", baseline.latencyP99, current.latencyP99, args.threshold, false),
    ];

    writeComparisonSummary(checks, args, { current: current.errors, baseline: baseline.errors });

    const anyRegressed = checks.some((c) => c.regressed);
    if (anyRegressed) {
        console.error("\n❌ Performance regression detected — failing CI.");
        process.exit(1);
    }

    console.log("\n✅ No regression detected.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Benchmark comparison failed with an unexpected error:", err);
    process.exit(1);
});