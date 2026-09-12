"""run_regione_lombardia_monitor.py
pip install apify-client
"""
import os
from apify_client import ApifyClient

# Reads your Apify API token from the environment - get one from
# Apify Console under Settings -> Integrations, or via `apify login`.
client = ApifyClient(os.environ["APIFY_API_TOKEN"])

# Every field is optional (see .actor/input_schema.json). This run filters
# to currently-open economic development bandi and names a dedicated
# delta state so it doesn't share baseline progress with other schedules.
run_input = {
    "onlyNew": True,
    "statusFilter": ["OPEN"],
    "policyAreaFilter": ["ECONOMIC_DEVELOPMENT_INNOVATION"],
    "deltaStateName": "sme-grants-watch",
}

# f0xRlvzERsbgbU1ru is this Actor's stable ID in Apify Console.
# .call() starts the run and waits for it to finish.
run = client.actor("f0xRlvzERsbgbU1ru").call(run_input=run_input)

# Pull the delta events the run just delivered to its default dataset.
dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items

print(f"Run {run['id']} finished with status {run['status']}")
print(f"{len(dataset_items)} delta events delivered:")
for item in dataset_items:
    print(f"- [{item['event_type']}] {item['codice_bando']}: {item['titolo_bando']}")
