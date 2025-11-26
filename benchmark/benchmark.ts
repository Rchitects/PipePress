/*** imports ***/
import { spawn } from "child_process";
import autocannon from "autocannon";
import pidusage from "pidusage";

/*** define frameworks ***/
const OUT_DIR = "dist-benchmark";
const frameworks = [
    { name: "express", cmd: "node", args: [`${OUT_DIR}/servers/express.js`], port: 3001 },
    { name: "fastify", cmd: "node", args: [`${OUT_DIR}/servers/fastify.js`], port: 3002 },
    { name: "nest", cmd: "node", args: [`${OUT_DIR}/servers/nestjs.js`], port: 3003 },
    { name: "pipepress", cmd: "node", args: [`${OUT_DIR}/servers/pipepress.js`], port: 3004 },
];

/*** benchmark runner ***/
async function runBenchmark(framework: typeof frameworks[0]) {
    return new Promise((resolve) => {
        const proc = spawn(framework.cmd, framework.args, { stdio: "inherit" });

        setTimeout(async () => {
            console.log(`\n🔫 Benchmarking ${framework.name}...`);

            const result = await autocannon({
                url: `http://localhost:${framework.port}/echo`,
                connections: 100,
                duration: 20,
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "R" }),
            });

            const stats = await pidusage(proc.pid!);
            proc.kill();

            const throughputMB = (result.throughput.average / 1024 / 1024).toFixed(2) + " MB/s";


            resolve({
                name: framework.name,
                rps: result.requests.average,
                latency: result.latency.average,
                throughput: throughputMB,
                memoryMB: ((stats as any).memory / 1024 / 1024).toFixed(2),
            });
        }, 2000);
    });
}

/*** main ***/
(async () => {
    const results = [];
    for (const fw of frameworks) {
        const res = await runBenchmark(fw);
        results.push(res);
    }

    console.table(results);
})();
