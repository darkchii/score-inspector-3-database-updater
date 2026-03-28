//Keeps a live duplicate table on local server

const { Op } = require("@sequelize/core");
const { AltBeatmapLive, InspectorBeatmapLive } = require("../db");

const cacher = {
    func: UpdateBeatmapCopy,
    name: 'UpdateBeatmapCopy',
}

module.exports = cacher;

const SOURCE = AltBeatmapLive;
const TARGET = InspectorBeatmapLive;

const BATCH_SIZE = 2000;
const MINIMUM_LCHG_TIME_DIFF = 60000; //1 second, to avoid unnecessary updates due to minor lchg_time differences
async function UpdateBeatmapCopy() {
    try {
        //first check for reverse missing maps, and delete them from TARGET
        try{
            const SOURCE_IDS = await SOURCE.findAll({
                attributes: ['beatmap_id']
            });
            const SOURCE_ID_SET = new Set(SOURCE_IDS.map(b => b.beatmap_id));
            const TARGET_IDS = await TARGET.findAll({
                attributes: ['beatmap_id']
            });
            
            const MISSING_IN_SOURCE = TARGET_IDS.filter(b => !SOURCE_ID_SET.has(b.beatmap_id));
            if(MISSING_IN_SOURCE.length > 0){
                await TARGET.destroy({
                    where: {
                        beatmap_id: {
                            [Op.in]: MISSING_IN_SOURCE.map(b => b.beatmap_id)
                        }
                    }
                });
                console.log(`Deleted ${MISSING_IN_SOURCE.length} missing beatmaps from TARGET`);
            }
        }catch(err){
            console.warn('Error deleting missing beatmaps from TARGET');
            console.warn(err);
        }

        let lastId = 0;
        let totalInserts = 0;
        let totalUpdates = 0;
        while(true){
            //Fetch all beatmaps from SOURCE, greater than lastId, ordered by beatmap_id, limit BATCH_SIZE
            //Then insert or update them in TARGET
            //Only update if lchg_time is different, to avoid unnecessary updates
            const SOURCE_SET = await SOURCE.findAll({
                where: {
                    beatmap_id: {
                        [Op.gt]: lastId
                    }
                },
                order: [['beatmap_id', 'ASC']],
                limit: BATCH_SIZE
            });

            if(SOURCE_SET.length === 0){
                break;
            }

            const TARGET_SET = await TARGET.findAll({
                where: {
                    beatmap_id: {
                        [Op.in]: SOURCE_SET.map(b => b.beatmap_id)
                    }
                }
            });

            const TARGET_MAP = {};
            for(const beatmap of TARGET_SET){
                TARGET_MAP[beatmap.beatmap_id] = beatmap;
            }

            const INSERTS = [];
            const UPDATES = [];

            for(const beatmap of SOURCE_SET){
                const target_beatmap = TARGET_MAP[beatmap.beatmap_id];
                if(!target_beatmap){
                    INSERTS.push(beatmap);
                } else {
                    const diff = beatmap.lchg_time.getTime() - target_beatmap.lchg_time.getTime();
                    if(Math.abs(diff) > MINIMUM_LCHG_TIME_DIFF){
                        UPDATES.push(beatmap);
                    }
                }
            }

            //Bulk insert and update
            if(INSERTS.length > 0){
                await TARGET.bulkCreate(INSERTS.map(b => b.toJSON()));
            }

            if(UPDATES.length > 0){
                for(const beatmap of UPDATES){
                    await TARGET.update(beatmap.toJSON(), {
                        where: {
                            beatmap_id: beatmap.beatmap_id
                        }
                    });
                }
            }

            lastId = SOURCE_SET[SOURCE_SET.length - 1].beatmap_id;

            totalInserts += INSERTS.length;
            totalUpdates += UPDATES.length;

            console.log(`Processed batch, lastId: ${lastId}, inserts: ${INSERTS.length}, updates: ${UPDATES.length}`);
        }
        console.log(`Finished updating beatmap copy, total inserts: ${totalInserts}, total updates: ${totalUpdates}`);
    } catch (err) {
        console.warn('Error updating beatmap copy');
        console.warn(err);
    }
}
