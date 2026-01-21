const { DataTypes } = require("@sequelize/core");

const OsuTeamRulesetModel = (db) => db.define('OsuTeamRuleset', {
    id: { type: DataTypes.INTEGER, primaryKey: true, },
    mode: { type: DataTypes.STRING, primaryKey: true, },
    play_count: { type: DataTypes.INTEGER, allowNull: false, },
    ranked_score: { type: DataTypes.INTEGER, allowNull: false, },
    average_score: { type: DataTypes.INTEGER, allowNull: false, },
    performance: { type: DataTypes.INTEGER, allowNull: false, },
    clears: { type: DataTypes.INTEGER, allowNull: true},
    total_ss: { type: DataTypes.INTEGER, allowNull: true},
    total_s: { type: DataTypes.INTEGER, allowNull: true},
    total_a: { type: DataTypes.INTEGER, allowNull: true},
    total_score: { type: DataTypes.INTEGER, allowNull: true},
    play_time: { type: DataTypes.INTEGER, allowNull: true},
    total_hits: { type: DataTypes.INTEGER, allowNull: true},
    replays_watched: { type: DataTypes.INTEGER, allowNull: true},
}, {
    tableName: 'osu_teams_ruleset',
    timestamps: false
});
module.exports.OsuTeamRulesetModel = OsuTeamRulesetModel;