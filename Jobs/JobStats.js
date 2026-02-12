const { default: Sequelize, Op } = require("@sequelize/core");
const { AltBeatmapLive, InspectorStat, AltScoreLive, AltUserLive, InspectorTeam, Databases } = require("../db");
require('dotenv').config();

const cacher = {
    func: UpdateStats,
    name: 'UpdateStats',
}

module.exports = cacher;

async function UpdateStats() {
    console.log(`[SYSTEM STATS] Updating system stats ...`);
    await UpdateCounts();
    console.log(`[SYSTEM STATS] Finished updating system stats`);
}

async function UpdateCounts() {
    await CountBeatmaps();
    await CountScores();
    await CountUsers();
    await CountTeams();

    await ProcessTodayTopPlayers();
    await ProcessActiveUsers();
    await CountScoreData();
}

async function CountBeatmaps() {
    try {
        //count beatmaps
        //(all, and by mode)
        const data = await AltBeatmapLive.findAll({
            attributes: ['mode', [Sequelize.fn('COUNT', Sequelize.col('beatmap_id')), 'count']],
            where: {
                ranked_raw: { [Op.in]: [1, 2, 4] }
            },
            group: ['mode']
        });

        const counts = {};
        let total = 0;
        data.forEach(row => {
            counts[`mode_${row.mode}`] = parseInt(row.get('count'));
            total += parseInt(row.get('count'));
        }
        );
        counts['total'] = total;
        //create/update InspectorStat 'beatmap_counts'
        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'beatmap_counts' },
            defaults: {
                data: JSON.stringify(counts),
                last_updated: new Date()
            }
        });

        if (!created) {
            stat.data = JSON.stringify(counts);
            stat.last_updated = new Date();
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to update counts:`);
        console.log(e);
    }
}

async function CountScores() {
    try {
        //pass 1: count all scores, regardless of overwrites by players (same as beatmaps)
        const score_count = await AltScoreLive.findAll({
            attributes: ['ruleset_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            group: ['ruleset_id']
        });

        const counts = {
            'scores': {}, //by ruleset, all scores
            'clears': {} //by ruleset, only unique scores per user_id
        };

        let total = 0;
        score_count.forEach(row => {
            counts.scores[`ruleset_${row.ruleset_id}`] = parseInt(row.get('count'));
            total += parseInt(row.get('count'));
        });
        counts.scores['total'] = total;

        //pass 2: count unique scores
        const clears_count = await AltScoreLive.findAll({
            attributes: ['ruleset_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
            where: {
                highest_pp: true
            },
            group: ['ruleset_id']
        });
        let clears_total = 0;
        clears_count.forEach(row => {
            counts.clears[`ruleset_${row.ruleset_id}`] = parseInt(row.get('count'));
            clears_total += parseInt(row.get('count'));
        });
        counts.clears['total'] = clears_total;

        //create/update InspectorStat 'score_counts'
        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'score_counts' },
            defaults: {
                data: JSON.stringify(counts),
                last_updated: new Date()
            }
        });

        if (!created) {
            stat.data = JSON.stringify(counts);
            stat.last_updated = new Date();
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to update score counts:`);
        console.log(e);
    }
}

async function CountUsers() {
    try {
        const count = await AltUserLive.count();
        //create/update InspectorStat 'user_counts'
        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'user_counts' },
            defaults: {
                data: JSON.stringify({ total: count }),
                last_updated: new Date()
            }
        });
        if (!created) {
            stat.data = JSON.stringify({ total: count });
            stat.last_updated = new Date();
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to update user counts:`);
        console.log(e);
    }
}

async function CountTeams() {
    try {
        const count = await InspectorTeam.count({
            where: {
                deleted: false
            }
        });
        //create/update InspectorStat 'team_counts'
        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'team_counts' },
            defaults: {
                data: JSON.stringify({ total: count }),
                last_updated: new Date()
            }
        });

        if (!created) {
            stat.data = JSON.stringify({ total: count });
            stat.last_updated = new Date();
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to update team counts:`);
        console.log(e);
    }
}

async function ProcessTodayTopPlayers() {
    try {
        const today = new Date();
        const yesterday = new Date();
        const thisYear = new Date();
        const lastYear = new Date();
        const lastYearEnd = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        thisYear.setMonth(0); thisYear.setDate(1); thisYear.setHours(0, 0, 0, 0);
        lastYear.setFullYear(lastYear.getFullYear() - 1); lastYear.setMonth(0); lastYear.setDate(1); lastYear.setHours(0, 0, 0, 0);
        lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1); lastYearEnd.setMonth(11); lastYearEnd.setDate(31); lastYearEnd.setHours(23, 59, 59, 999);

        const leaderboards = {
            today: {
                start: today
            },
            yesterday: {
                start: yesterday
            },
            year: { 
                start: thisYear, 
                end: new Date() 
            },
            last_year: { 
                start: lastYear, 
                end: lastYearEnd 
            }
        };

        for (let ruleset_id = 0; ruleset_id <= 4; ruleset_id++) {
            //do above, but use a for loop so we can just easily add more timeframes if needed
            //use the keys of 'leaderboards' ofc
            for (const timeframe of Object.keys(leaderboards)) {
                const data_clears = await queryDayLeaderboard(ruleset_id, leaderboards[timeframe].start, 'count(*)', ['legacy_total_score', 'classic_total_score'], [], 10, leaderboards[timeframe].end || null);
                const data_ss_clears = await queryDayLeaderboard(ruleset_id, leaderboards[timeframe].start, 'sum(case when grade = \'XH\' or grade = \'X\' then 1 else 0 end)', ['legacy_total_score', 'classic_total_score'], ['grade'], 10, leaderboards[timeframe].end || null);
                const data_score = await queryDayLeaderboard(ruleset_id, leaderboards[timeframe].start, 'sum(case when legacy_total_score > 0 then legacy_total_score else classic_total_score end)', ['legacy_total_score', 'classic_total_score'], ['legacy_total_score', 'classic_total_score'], 10, leaderboards[timeframe].end || null);

                leaderboards[timeframe][`ruleset_${ruleset_id}`] = { clears: data_clears, ss_clears: data_ss_clears, score: data_score };

                console.log(`[SYSTEM STATS] Processed today top players for ruleset ${ruleset_id} and timeframe ${timeframe}`);
            }
        }

        //remove start/end from leaderboards before saving
        for (const timeframe of Object.keys(leaderboards)) {
            delete leaderboards[timeframe].start;
            delete leaderboards[timeframe].end;
        }

        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'today_top_players' },
            defaults: {
                data: JSON.stringify(leaderboards),
                last_updated: new Date()
            }
        });

        if (!created) {
            stat.data = JSON.stringify(leaderboards);
            stat.last_updated = new Date();
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to process today top players:`);
        console.log(e);
    }
}

async function queryDayLeaderboard(ruleset_id, date_start, select_clear, primary_stats = ['pp'], included_attributes = [], limit = 10, date_end = null) {
    const start = new Date(date_start);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date_end || date_start);
    end.setUTCHours(23, 59, 59, 999);
    const ruleset_query = ruleset_id < 4 ? `AND ruleset_id = ${ruleset_id}` : '';
    const query = `
            WITH normalized_scores AS (
            SELECT
                user_id_fk,
                beatmap_id_fk,
                ${included_attributes.map(attr => `${attr}`).join(', ')}${included_attributes.length > 0 ? ',' : ''}
                ended_at${primary_stats.length > 0 ? `, GREATEST(${primary_stats.map(stat => `NULLIF(${stat}, 0)`).join(', ')}) as primary_stat` : ''}
            FROM scorelive
            WHERE 1=1 ${ruleset_query} AND ended_at <= :end
        ),
        best_scores AS (
            SELECT DISTINCT ON (user_id_fk, beatmap_id_fk)
                user_id_fk,
                beatmap_id_fk,
                ended_at,
                ${included_attributes.map(attr => `${attr}`).join(', ')}${included_attributes.length > 0 ? ',' : ''}
                primary_stat
            FROM normalized_scores
            WHERE primary_stat IS NOT NULL
            ORDER BY
                user_id_fk,
                beatmap_id_fk,
                primary_stat DESC,
                ended_at DESC
        ),
        today_best_scores AS (
            SELECT
                user_id_fk${included_attributes.length > 0 ? `,` : ''}
                ${included_attributes.map(attr => `${attr}`).join(', ')}
            FROM best_scores
            WHERE ended_at BETWEEN :start AND :end
        )
        SELECT
            user_id_fk,
            ${select_clear} as clear
        FROM today_best_scores
        GROUP BY user_id_fk
        ORDER BY clear DESC
        LIMIT ${limit};
    `;
    const data_cleared = await Databases.osuAlt.query(query, {
        replacements: {
            ruleset_id,
            start,
            end
        },
        type: Sequelize.QueryTypes.SELECT,
    });

    const user_ids = data_cleared.map(row => row.user_id_fk);
    //for all the users, also get the total number, so without unique beatmaps
    if (user_ids.length === 0) { return []; }
    const data_all = await Databases.osuAlt.query( //directly insert user_ids into query (they cant be injected)
        `SELECT 
            user_id_fk,
            ${select_clear} as clear
        FROM scorelive
        WHERE 1=1 ${ruleset_query}
        AND ended_at BETWEEN :start AND :end
        AND user_id_fk IN (${user_ids.join(',')})
        GROUP BY user_id_fk
        ORDER BY clear DESC
        `
        , {
            replacements: {
                ruleset_id,
                start,
                end
            },
            type: Sequelize.QueryTypes.SELECT
        });

    let _data = data_cleared.map(row => ({
        user_id: row.user_id_fk,
        clear: parseInt(row.clear),
        total: data_all.find(x => x.user_id_fk === row.user_id_fk) ? parseInt(data_all.find(x => x.user_id_fk === row.user_id_fk).clear) : 0
    }));
    return _data;
}

async function ProcessActiveUsers() {
    //for the last 24 hours, per hour, count unique active users (user_id_fk in scorelive)
    try {
        const now = new Date();
        const active_users = [];
        for (let i = 0; i < 24; i++) {
            const end = new Date(now);
            end.setHours(end.getHours() - i);
            const start = new Date(end);
            start.setHours(start.getHours() - 1);
            const count = await Databases.osuAlt.query(`
                SELECT COUNT(DISTINCT user_id_fk) as count
                FROM scorelive
                WHERE ended_at BETWEEN :start AND :end
            `, {
                replacements: {
                    start,
                    end
                },
                type: Sequelize.QueryTypes.SELECT
            });
            active_users.push({
                hour: end.toISOString().slice(0, 13) + ':00:00Z',
                count: parseInt(count[0].count)
            });
        }
        //create/update InspectorStat 'active_users'
        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'active_users' },
            defaults: {
                data: JSON.stringify(active_users),
                last_updated: new Date()
            }
        });
        if (!created) {
            stat.data = JSON.stringify(active_users);
            stat.last_updated = new Date();
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to process active users:`);
        console.log(e);
    }
}

const scoreDataTimeframes = [
    { name: 'hours', duration: 720 }, //last 720 hours
    { name: 'days', duration: 180 }, //last 180 days
    { name: 'months', duration: null }, //all months
    { name: 'years', duration: null } //all years
];

async function CountScoreData() {
    try {
        //count score submissions for the following:
        //Hours: last 720 hours
        //Days: last 180 days
        //Months: all months
        //Years: all years 
        //So for Years, let's say 2011, count all scores IN 2011 only (so start: 2011-01-01 00:00:00, end: 2011-12-31 23:59:59)
        //also count amount of grades (XH, X, SH, S, A, B, C, D, F) and score (legacy_total_score/classic_total_score whichever is higher) per timeframe 
        const now = new Date();

        for (const ruleset_id of [0, 1, 2, 3, 4]) {
            let data = {};
            for (const timeframe of scoreDataTimeframes) {
                //use a single query to get all counts per timeframe
                let timeCondition = '';
                let timeFormat = '';
                if (timeframe.name === 'hours') {
                    const pastDate = new Date(now);
                    pastDate.setHours(pastDate.getHours() - timeframe.duration);
                    timeCondition = `AND ended_at >= '${pastDate.toISOString().slice(0, 19).replace('T', ' ')}'`;
                    timeFormat = 'YYYY-MM-DD HH24';
                } else if (timeframe.name === 'days') {
                    const pastDate = new Date(now);
                    pastDate.setDate(pastDate.getDate() - timeframe.duration);
                    timeCondition = `AND ended_at >= '${pastDate.toISOString().slice(0, 19).replace('T', ' ')}'`;
                    timeFormat = 'YYYY-MM-DD';
                } else if (timeframe.name === 'months') {
                    timeCondition = ''; //all months
                    timeFormat = 'YYYY-MM';
                } else if (timeframe.name === 'years') {
                    timeCondition = ''; //all years
                    timeFormat = 'YYYY';
                }
                const ruleset_query = ruleset_id < 4 ? `AND ruleset_id = ${ruleset_id}` : '';
                const query = `
                SELECT 
                    TO_TIMESTAMP(ended_at::text, '${timeFormat}') as period,
                    COUNT(*) as total_scores,
                    SUM(CASE WHEN grade = 'XH' THEN 1 ELSE 0 END) as xh_count,
                    SUM(CASE WHEN grade = 'X' THEN 1 ELSE 0 END) as x_count,
                    SUM(CASE WHEN grade = 'SH' THEN 1 ELSE 0 END) as sh_count,
                    SUM(CASE WHEN grade = 'S' THEN 1 ELSE 0 END) as s_count,
                    SUM(CASE WHEN grade = 'A' THEN 1 ELSE 0 END) as a_count,
                    SUM(CASE WHEN grade = 'B' THEN 1 ELSE 0 END) as b_count,
                    SUM(CASE WHEN grade = 'C' THEN 1 ELSE 0 END) as c_count,
                    SUM(CASE WHEN grade = 'D' THEN 1 ELSE 0 END) as d_count,
                    SUM(CASE WHEN legacy_total_score > classic_total_score THEN legacy_total_score ELSE classic_total_score END) as total_score_sum
                FROM scorelive
                WHERE 1=1 ${ruleset_query} ${timeCondition}
                GROUP BY period
                ORDER BY period DESC;
            `;
                const results = await Databases.osuAlt.query(query, {
                    type: Sequelize.QueryTypes.SELECT,
                    replacements: {
                        ruleset_id
                    }
                });
                data[timeframe.name] = results.map(row => ({
                    period: row.period,
                    total_scores: parseInt(row.total_scores),
                    grades: {
                        XH: parseInt(row.xh_count),
                        X: parseInt(row.x_count),
                        SH: parseInt(row.sh_count),
                        S: parseInt(row.s_count),
                        A: parseInt(row.a_count),
                        B: parseInt(row.b_count),
                        C: parseInt(row.c_count),
                        D: parseInt(row.d_count),
                    },
                    total_score_sum: parseInt(row.total_score_sum)
                }));
            }
            //create/update InspectorStat 'score_data_counts'
            const [stat, created] = await InspectorStat.findOrCreate({
                where: { metric: `score_data_counts_ruleset_${ruleset_id}` },
                defaults: {
                    data: JSON.stringify(data),
                    last_updated: new Date()
                }
            });
            if (!created) {
                stat.data = JSON.stringify(data);
                stat.last_updated = new Date();
                await stat.save();
            }
        }

    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to count score data:`);
        console.log(e);
    }
}

//if dev
if (process.env.NODE_ENV === 'development') {
    // UpdateStats();
    // ProcessTodayTopPlayers();
}