import * as core from '@actions/core';
import * as fs from 'fs/promises';
import { resolve } from 'path';

/**
 * The main function for the action.
 *
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run() {
  try {
    // Configurations
    const zone_id = core.getInput("zone_id");
    const api_token = core.getInput("api_token");
    const file_name = core.getInput("file_name");
    const auto_enable = core.getInput("enable");
    const delete_others = core.getInput("delete_others");
    const skip_failed_deletes = core.getInput("skip_failed_deletes");
    const base_uri = `https://api.cloudflare.com/client/v4/zones/${zone_id}/schema_validation`;

    const auth_headers = new Headers({
      "Authorization": `Bearer ${api_token}`
    });

    // Read the spec
    core.info("reading openapi spec...")
    const data = await fs.readFile(resolve("./", file_name), { encoding: 'utf8' });

    // build the upload payload
    core.info("building upload payload...");
    const schema_payload = {
      "kind": "openapi_v3",
      "name": file_name,
      "source": data
    };
    if (auto_enable) {
      schema_payload.validation_enabled = true;
    }

    let new_schema_key = null;
    // copy the headers, we need to add content type
    const upload_headers = auth_headers;
    upload_headers.set("Content-Type", "application/json");

    // run the upload
    core.info("uploading spec...");
    const api_shield_upload_resp = await fetch(`${base_uri}/schemas`, {
      headers: upload_headers,
      method: "POST",
      body: JSON.stringify(schema_payload)
    });
    if (api_shield_upload_resp.ok) {
      const data = await api_shield_upload_resp.json();
      if (data.success) {
        // save out the new schema's id, we want to make sure we don't delete it
        new_schema_key = data.result.schema_id;
        core.info(`uploaded new schema ${new_schema_key}`);
      } else {
        core.setFailed("failed to upload to the API Shield");
        return;
      }
    } else {
      core.setFailed(`Unable to upload to API Shield, got error ${api_shield_upload_resp.status}`);
      return;
    }

    // if we are not to download the other schemas, then end the task asap
    if (!delete_others) {
      core.notice("task complete");
      return;
    }

    let other_schemas = [];
    core.info("fetching other schemas...");
    // grab all the current schemas that are uploaded
    const get_uploaded_schemas = await fetch(`${base_uri}/schemas`, {
      headers: auth_headers
    });
    if (get_uploaded_schemas.ok) {
      core.info("parsing other schemas...");
      const data = await get_uploaded_schemas.json();

      // Parse the output, looking for openapi schemas that match this name
      // and are also currently enabled
      //
      // we do skip over the schema we just uploaded though
      for (const schema_data of data.result) {
        if (schema_data.kind === "openapi_v3" &&
            schema_data.name === file_name &&
            schema_data.validation_enabled === true &&
            schema_data.schema_id !== new_schema_key
        ) {
          other_schemas.push(schema_data.schema_id);
        }
      }
    } else {
      core.setFailed(`Could not get other upload schemas, got error ${get_uploaded_schemas.status}`);
      return;
    }

    // if there are no other schemas to manage, then end the task
    if (other_schemas.length == 0) {
      core.notice("task complete");
      return;
    }

    // otherwise, march through and delete the other schemas
    let failed_delete = false;
    core.info(`attempting to delete ${other_schemas.length} other schemas...`);
    for (const schema_id of other_schemas) {
      failed_delete = false;
      const delete_query = await fetch(`${base_uri}/schemas/${schema_id}`, {
        headers: auth_headers,
        method: "DELETE"
      });
      if (delete_query.ok) {
        const delete_query_resp = await delete_query.json();
        if (delete_query_resp.success)
          core.info(`* deleted schema ${schema_id}`);
        else
          failed_delete = true;
      } else {
        failed_delete = true;
      }

      // handle delete task failure
      if (failed_delete) {
        if (skip_failed_deletes)
          core.warning(`* failed to delete ${schema_id}`);
        else {
          core.setFailed(`failed to delete ${schema_id}, exiting!!`);
          return;
        }
      }
    }
    core.notice("task complete");
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}
