const { DataTypes } = require("@sequelize/core");

const OsuTeamModel = (db) => db.define('OsuTeam', {
    id: { type: DataTypes.INTEGER, primaryKey: true, },
    name: { type: DataTypes.STRING, allowNull: false, },
    short_name: { type: DataTypes.STRING, allowNull: true, },
    flag_url: { type: DataTypes.STRING, allowNull: true, },
    members: { type: DataTypes.INTEGER, allowNull: false, },
    last_updated: { type: DataTypes.DATE, allowNull: false, },
    deleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    last_scraped: { type: DataTypes.DATE, allowNull: true, },
    applications_open: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    header_url: { type: DataTypes.STRING, allowNull: true, },
    url: { type: DataTypes.STRING, allowNull: true, },
    color: { type: DataTypes.STRING, allowNull: true, },
    created_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'osu_teams',
    timestamps: false
});
module.exports.OsuTeamModel = OsuTeamModel;