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
            }
        });

        if (!created) {
            stat.data = JSON.stringify(counts);
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
            }
        });

        if (!created) {
            stat.data = JSON.stringify(counts);
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
            }
        });
        if (!created) {
            stat.data = JSON.stringify({ total: count });
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
            }
        });

        if (!created) {
            stat.data = JSON.stringify({ total: count });
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
        yesterday.setDate(yesterday.getDate() - 1);

        const leaderboards = {
            today: {},
            yesterday: {}
        };

        for (let ruleset_id = 0; ruleset_id <= 3; ruleset_id++) {
            if(!leaderboards.today[ruleset_id]) { leaderboards.today[ruleset_id] = {}; }
            if(!leaderboards.yesterday[ruleset_id]) { leaderboards.yesterday[ruleset_id] = {}; }

            if (!leaderboards.today[ruleset_id].clears) { leaderboards.today[ruleset_id].clears = []; }
            if (!leaderboards.today[ruleset_id].ss_clears) { leaderboards.today[ruleset_id].ss_clears = []; }
            if (!leaderboards.today[ruleset_id].score) { leaderboards.today[ruleset_id].score = []; }

            if (!leaderboards.yesterday[ruleset_id].clears) { leaderboards.yesterday[ruleset_id].clears = []; }
            if (!leaderboards.yesterday[ruleset_id].ss_clears) { leaderboards.yesterday[ruleset_id].ss_clears = []; }
            if (!leaderboards.yesterday[ruleset_id].score) { leaderboards.yesterday[ruleset_id].score = []; }

            const data_clears = await queryDayLeaderboard(ruleset_id, today, 'count(*)');
            const data_ss_clears = await queryDayLeaderboard(ruleset_id, today, 'sum(case when grade = \'XH\' or grade = \'X\' then 1 else 0 end)', ['pp'], ['grade']);
            const data_score = await queryDayLeaderboard(ruleset_id, today, 'sum(case when legacy_total_score > 0 then legacy_total_score else classic_total_score end)', ['legacy_total_score', 'classic_total_score'], ['legacy_total_score', 'classic_total_score']);

            const data_clears_yesterday = await queryDayLeaderboard(ruleset_id, yesterday, 'count(*)');
            const data_ss_clears_yesterday = await queryDayLeaderboard(ruleset_id, yesterday, 'sum(case when grade = \'XH\' or grade = \'X\' then 1 else 0 end)', ['pp'], ['grade']);
            const data_score_yesterday = await queryDayLeaderboard(ruleset_id, yesterday, 'sum(case when legacy_total_score > 0 then legacy_total_score else classic_total_score end)', ['legacy_total_score', 'classic_total_score'], ['legacy_total_score', 'classic_total_score']);

            leaderboards.today[ruleset_id].clears = data_clears;
            leaderboards.today[ruleset_id].ss_clears = data_ss_clears;
            leaderboards.today[ruleset_id].score = data_score;

            leaderboards.yesterday[ruleset_id].clears = data_clears_yesterday;
            leaderboards.yesterday[ruleset_id].ss_clears = data_ss_clears_yesterday;
            leaderboards.yesterday[ruleset_id].score = data_score_yesterday;
        }

        const [stat, created] = await InspectorStat.findOrCreate({
            where: { metric: 'today_top_players' },
            defaults: {
                data: JSON.stringify(leaderboards),
            }
        });

        if (!created) {
            stat.data = JSON.stringify(leaderboards);
            await stat.save();
        }
    } catch (e) {
        console.log(`[SYSTEM STATS] Failed to process today top players:`);
        console.log(e);
    }
}

async function queryDayLeaderboard(ruleset_id, date, select_clear, primary_stats = ['pp'], included_attributes = [], limit = 10) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setUTCHours(23, 59, 59, 999);
    const data_cleared = await Databases.osuAlt.query(
        `SELECT 
            user_id_fk, 
            ${select_clear} as clear
        FROM (
            SELECT
                user_id_fk,
                beatmap_id_fk,
                ${included_attributes.length > 0 ? included_attributes.join(', ') + ', ' : ''}
                ${primary_stats.map(stat => `MAX(CASE WHEN ${stat} IS NOT NULL AND ${stat} > 0 THEN ${stat} ELSE 0 END) AS max_${stat}`).join(', ')}
            FROM scorelive
            WHERE ruleset_id = :ruleset_id
            AND ended_at BETWEEN :start AND :end
            GROUP BY user_id_fk, beatmap_id_fk${included_attributes.length > 0 ? ', ' + included_attributes.join(', ') : ''}
        ) AS t
        GROUP BY user_id_fk
        ORDER BY clear DESC
        LIMIT ${limit}
        `
        , {
            replacements: {
                ruleset_id,
                start,
                end
            },
            type: Sequelize.QueryTypes.SELECT
        });

    const user_ids = data_cleared.map(row => row.user_id_fk);
    //for all the users, also get the total number, so without unique beatmaps
    const data_all = await Databases.osuAlt.query( //directly insert user_ids into query (they cant be injected)
        `SELECT 
            user_id_fk,
            ${select_clear} as clear
        FROM scorelive
        WHERE ruleset_id = :ruleset_id
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

//if dev
if (process.env.NODE_ENV === 'development') {
    UpdateStats();
}