# Cloudflare API Shield Upload

Really simple GH Action that allows you to upload OpenAPI specifications to the API Shield without having to do it manually.

## Parameters

| Parameter       | Description                                                                 | Default        | Required |
| -----------------| -----------------------------------------------------------------------------| ----------------| ----------|
| `api_token`     | Cloudflare API token with Domain or Account API Gateway Edit Support        | ""             | Yes      |
| `zone_id`       | The zone to upload the spec to                                              | ""             | Yes      |
| `file_name`     | The specification file's name                                               | "openapi.json" | No       |
| `delete_others` | If other endpoint specifications should be deleted that also have this name | true           | No       |
| `skip_failed_deletes` | If we fail to delete any of the schemas, should we continue processing?     | true           | No       |
| `enable`        | If the new spec should be enabled automatically                             | true           | No       |


## Examples

### Basic Pipeline Usage

```yaml
jobs:
  generate_openapi:
    runs-on: ubuntu-latest
    steps:
      - name: Generate OpenAPI Endpoints
        run: echo make endpoints
      - name: Upload API Endpoints
        uses: socksthewolf/cloudflare-upload-spec@main
        with:
          zone_id: ${{ vars.CLOUDFLARE_ZONE_ID }}
          api_token: ${{ secrets.CLOUDFLARE_TOKEN }}
```
