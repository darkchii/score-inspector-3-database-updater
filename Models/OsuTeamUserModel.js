const { DataTypes } = require("@sequelize/core");

const OsuTeamUserModel = (db) => db.define('OsuTeamUser', {
    id: { type: DataTypes.INTEGER, primaryKey: true, },
    mode: { type: DataTypes.INTEGER, primaryKey: true, },
    username: { type: DataTypes.STRING, allowNull: false, },
    last_updated: { type: DataTypes.DATE, allowNull: true, },
    count_300: { type: DataTypes.INTEGER, allowNull: true },
    count_100: { type: DataTypes.INTEGER, allowNull: true },
    count_50: { type: DataTypes.INTEGER, allowNull: true },
    count_miss: { type: DataTypes.INTEGER, allowNull: true },
    play_count: { type: DataTypes.INTEGER, allowNull: true },
    ranked_score: { type: DataTypes.INTEGER, allowNull: true },
    total_score: { type: DataTypes.INTEGER, allowNull: true },
    pp: { type: DataTypes.FLOAT, allowNull: true },
    global_rank: { type: DataTypes.INTEGER, allowNull: true },
    hit_accuracy: { type: DataTypes.FLOAT, allowNull: true },
    play_time: { type: DataTypes.INTEGER, allowNull: true },
    total_hits: { type: DataTypes.INTEGER, allowNull: true },
    maximum_combo: { type: DataTypes.INTEGER, allowNull: true },
    replays_watched: { type: DataTypes.INTEGER, allowNull: true },
    count_ssh: { type: DataTypes.INTEGER, allowNull: true },
    count_ss: { type: DataTypes.INTEGER, allowNull: true },
    count_sh: { type: DataTypes.INTEGER, allowNull: true },
    count_s: { type: DataTypes.INTEGER, allowNull: true },
    count_a: { type: DataTypes.INTEGER, allowNull: true },
}, {
    tableName: 'osu_users',
    timestamps: false
});
module.exports.OsuTeamUserModel = OsuTeamUserModel;