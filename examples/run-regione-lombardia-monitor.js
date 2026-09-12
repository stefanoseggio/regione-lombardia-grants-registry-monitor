// run-regione-lombardia-monitor.js
// npm install apify-client
const { ApifyClient } = require('apify-client');

// Reads your Apify API token from the environment - get one from
// Apify Console under Settings -> Integrations, or via `apify login`.
const client = new ApifyClient({ token: process.env.APIFY_API_TOKEN });

async function main() {
    // Every field is optional (see .actor/input_schema.json). This run filters
    // to currently-open economic development bandi and names a dedicated
    // delta state so it doesn't share baseline progress with other schedules.
    const input = {
        onlyNew: true,
        statusFilter: ['OPEN'],
        policyAreaFilter: ['ECONOMIC_DEVELOPMENT_INNOVATION'],
        deltaStateName: 'sme-grants-watch',
    };

    // f0xRlvzERsbgbU1ru is this Actor's stable ID in Apify Console.
    // .call() starts the run and waits for it to finish.
    const run = await client.actor('f0xRlvzERsbgbU1ru').call(input);

    // Pull the delta events the run just delivered to its default dataset.
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`Run ${run.id} finished with status ${run.status}`);
    console.log(`${items.length} delta events delivered:`);
    for (const item of items) {
        console.log(`- [${item.event_type}] ${item.codice_bando}: ${item.titolo_bando}`);
    }
}

main().catch((err) => {
    console.error('Run failed:', err);
    process.exit(1);
});
