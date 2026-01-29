//this script is to store some data in the local database, like overall score statistics.
//mainly to circumvent extremely slow sql queries that don't need to be live
const schedule = require('node-schedule');
// const usersCacher = require("./Jobs/JobUsers.js");
// const performanceDistributionCacher = require("./Jobs/JobPerformanceDistribution.js");
const statsCacher = require("./Jobs/JobStats.js");
const scoreRankCacher = require("./Jobs/JobScoreRank.js");
// const populationStatsCacher = require("./Jobs/JobPopulation.js");
// const systemStatsCacher = require("./Jobs/JobSystemStats.js");
// const monthlyRankingsCacher = require("./Jobs/JobMonthlyRanking.js");
// const teamsCacher = require("./Jobs/JobTeams.js"); //included so it runs the code in there
require('dotenv').config();

function StartCacher() {
    Loop();
}
module.exports = StartCacher;

const Cachers = [
    //run every 4 hours, parallel to everything else so it doesn't interfere with the other jobs
    //(this is a very heavy job)
    // { cacher: monthlyRankingsCacher, interval: '0 */4 * * *', data: [], parallel: true }, //every 4 hours
    // { cacher: usersCacher, interval: '0 */1 * * *', data: [], onStart: true }, //every 1 hour
    // { cacher: performanceDistributionCacher, interval: '0 */4 * * *', data: [] }, //every 4 hours
    // { cacher: activityCacher, interval: '*/15 * * * *', data: [] }, //every 15 minutes
    // { cacher: statsCacher, interval: '*/10 * * * *', data: ['30min'] }, //every 10 minutes
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: 'osu' },
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: 'taiko' },
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: 'fruits' },
    { cacher: scoreRankCacher, interval: '1 0 * * *', data: 'mania' },
]

const jobQueue = [];

async function QueueProcessor() {
    while (true) {
        if (jobQueue.length > 0) {
            const job = jobQueue.shift();
            try {
                console.log(`[CACHER] Running ${job.cacher.name} ...`);
                if (job.timeout) {
                    await Promise.race([
                        job.cacher.func(job.data),
                        new Promise((resolve, reject) => {
                            setTimeout(() => {
                                reject(new Error('Function exceeded maximum run time'));
                            }, job.timeout * 60 * 1000);
                        })
                    ]);
                } else {
                    if (job.parallel) {
                        job.cacher.func(job.data);
                    } else {
                        await job.cacher.func(job.data);
                    }
                }
                console.log(`[CACHER] Finished ${job.cacher.name}`);
            } catch (e) {
                console.warn(`[CACHER] Error running ${job.cacher.name}`);
                console.warn(e);
            }
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

async function Loop() {
    for await (const cacher of Cachers) {
        if (cacher.onStart) {
            jobQueue.push(cacher);
        }
        schedule.scheduleJob(cacher.interval, () => {
            console.log(`[CACHER] Queuing ${cacher.cacher.name} ...`);
            jobQueue.push(cacher);
        });
        console.log(`[CACHER] Scheduled ${cacher.cacher.name} to run every ${cacher.interval}`);
    }
}

if (process.env.NODE_ENV === 'production') {
    QueueProcessor();
    Loop();
} else {
    console.log('Not in production mode, not starting cacher');
}
