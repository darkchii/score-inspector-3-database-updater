const { AltScore } = require("./db");

const db_now = "timezone('utc', now())";
module.exports.db_now = db_now;

const beatmap_columns = `
    beatmaps.approved, 
    beatmaps.submit_date, 
    beatmaps.approved_date, 
    beatmaps.last_update,
    beatmaps.artist,
    beatmaps.set_id,
    beatmaps.bpm,
    beatmaps.creator,
    beatmaps.creator_id,
    beatmaps.stars,
    beatmaps.diff_aim,
    beatmaps.diff_speed,
    beatmaps.cs,
    beatmaps.od,
    beatmaps.ar,
    beatmaps.hp,
    beatmaps.drain,
    beatmaps.source,
    beatmaps.genre,
    beatmaps.language,
    beatmaps.title,
    beatmaps.length,
    beatmaps.diffname,
    beatmaps.file_md5,
    beatmaps.mode,
    beatmaps.tags,
    beatmaps.favorites,
    beatmaps.rating,
    beatmaps.playcount,
    beatmaps.passcount,
    beatmaps.maxcombo,
    beatmaps.circles,
    beatmaps.sliders,
    beatmaps.spinners,
    beatmaps.storyboard,
    beatmaps.video,
    beatmaps.download_unavailable,
    beatmaps.audio_unavailable,
    beatmaps.beatmap_id
`;

const score_columns = `
    scores.user_id, 
    scores.beatmap_id, 
    scores.score, 
    scores.count300, 
    scores.count100, 
    scores.count50, 
    scores.countmiss, 
    scores.combo, 
    scores.perfect, 
    scores.enabled_mods, 
    scores.date_played, 
    scores.rank, 
    scores.pp, 
    scores.accuracy, 
    ${beatmap_columns},
    moddedsr.star_rating,
    moddedsr.aim_diff,
    moddedsr.speed_diff,
    moddedsr.fl_diff,
    moddedsr.slider_factor,
    moddedsr.speed_note_count,
    moddedsr.modded_od,
    moddedsr.modded_ar,
    moddedsr.modded_cs,
    moddedsr.modded_hp
`;

const score_columns_full = `
    scores.user_id, 
    scores.beatmap_id, 
    scores.score, 
    scores.count300, 
    scores.count100, 
    scores.count50, 
    scores.countmiss, 
    scores.combo, 
    scores.perfect, 
    scores.enabled_mods, 
    scores.date_played, 
    scores.rank, 
    scores.pp, 
    scores.accuracy, 
    ${beatmap_columns},
    moddedsr.star_rating,
    moddedsr.aim_diff,
    moddedsr.speed_diff,
    moddedsr.fl_diff,
    moddedsr.slider_factor,
    moddedsr.speed_note_count,
    moddedsr.modded_od,
    moddedsr.modded_ar,
    moddedsr.modded_cs,
    moddedsr.modded_hp,
    pack_id
    `;
module.exports.score_columns = score_columns;
module.exports.beatmap_columns = beatmap_columns;
module.exports.score_columns_full = score_columns_full;

module.exports.sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.ACHIEVEMENT_INTERVALS = [
    {
        name: 'Total SS',
        stats: ['ssh_count', 'ss_count'], //sum
        dir: '>',
        interval: 1000 //every 1000 ss is an achievement
    },
    {
        name: 'Total S',
        stats: ['sh_count', 's_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Silver SS',
        stats: ['ssh_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Silver S',
        stats: ['sh_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Gold SS',
        stats: ['ss_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Gold S',
        stats: ['s_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'A',
        stats: ['a_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Clears',
        stats: ['ssh_count', 'ss_count', 'sh_count', 's_count', 'a_count'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Ranked Score',
        stats: ['ranked_score'],
        dir: '>',
        interval: 10000000000
    }, {
        name: 'Total Score',
        stats: ['total_score'],
        dir: '>',
        interval: 10000000000
    }, {
        name: 'PP',
        stats: ['pp'],
        dir: '>',
        interval: 1000
    }, {
        name: 'Playtime',
        stats: ['playtime'],
        dir: '>',
        interval: 360000 //every 100 hours is a milestone
    }, {
        name: 'Playcount',
        stats: ['playcount'],
        dir: '>',
        interval: 10000
    }, {
        name: 'Level',
        stats: ['level'],
        dir: '>',
        interval: 1
    }, {
        name: 'Global Rank',
        stats: ['global_rank'],
        dir: '<',
        interval: 100000, //every 100000 ranks is a milestone
        intervalAlternative: [
            {
                dir: '<',
                check: 200000,
                interval: 10000 //if rank under 200000, every 10000 ranks is a milestone
            },
            {
                dir: '<',
                check: 10000,
                interval: 1000 //if rank under 10000, every 1000 ranks is a milestone
            },
            {
                dir: '<',
                check: 1000,
                interval: 100 //if rank under 1000, every 100 ranks is a milestone
            },
            {
                dir: '<',
                check: 100,
                interval: 10 //if rank under 100, every 10 ranks is a milestone
            }
        ]
    }
]