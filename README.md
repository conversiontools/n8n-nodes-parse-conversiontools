# n8n-nodes-parse-conversiontools

An [n8n](https://n8n.io) community node for [Parse by Conversion Tools](https://parse.conversiontools.io/integrations/n8n) - extract structured data from invoices, receipts, bank statements, purchase orders, bills of lading and other documents.

Define the fields once. Every document of that type comes back in the same shape, so the rest of your workflow can rely on it.

[Installation](#installation) · [Operations](#operations) · [Credentials](#credentials) · [Examples](#example-workflows) · [Resources](#resources)

## Installation

### Community Nodes (recommended)

1. In n8n, go to **Settings → Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-parse-conversiontools`
4. Agree to the risks of using community nodes and select **Install**

### Manual

```bash
npm install n8n-nodes-parse-conversiontools
```

For Docker-based deployments, add the package to your custom n8n image or mount it into `~/.n8n/nodes`.

## Credentials

You need a Parse API key.

1. Sign up at [parse.conversiontools.io](https://parse.conversiontools.io) - the free tier includes 100 pages per month
2. Open **Dashboard → API Keys** and create a key
3. In n8n, add a **Parse API** credential and paste the key

The credential test calls the usage endpoint, so verifying it costs you nothing.

## Operations

### Extract Document

Send a document and get structured data back.

- **Input Binary Field** - the binary property holding the file (`data` by default)
- **Schema** - pick one of your saved schemas from the dropdown. This is the normal path: a schema guarantees the same fields, in the same shape, for every document of that type
- **Fields** - alternatively, describe the fields inline as JSON for a one-off extraction
- **Wait for Completion** - on by default. Turn it off to get the extraction ID immediately and collect the result later
- **Timeout** - how long to wait. Long or dense documents take longer
- **Bypass Cache** - re-extract a document that was extracted before. Re-extraction counts against your page allowance
- **Webhook URL** - notified when the extraction finishes. The notification carries the ID and status only, never the extracted content

Supported inputs include PDF, PNG, JPG, HEIC and scanned documents.

### Get Extraction

Fetch a previous extraction by ID. Useful when **Wait for Completion** is off, or to re-read a result later.

### Export Extraction

Export an extraction to **CSV**, **Excel** or **JSON**.

### List Schemas

List the saved schemas on the account.

### Get Usage

Pages used against the monthly allowance.

## Example workflows

**Invoices in a folder, rows in a sheet**

```
Google Drive (New File) → Parse (Extract Document, schema "Supplier Invoice") → Google Sheets (Append Row)
```

**Email attachments to your accounting system**

```
Gmail (Trigger) → Parse (Extract Document) → Filter (total > 0) → HTTP Request (your ERP)
```

**Large batches without blocking the workflow**

```
Parse (Extract Document, Wait = off) → ... → Parse (Get Extraction) when the webhook fires
```

## Notes

- Extraction is asynchronous. This node polls for you when **Wait for Completion** is on, so a document that takes minutes still works inside a normal workflow
- Identical documents extracted against the same fields are served from cache and cost no pages
- The node is marked usable as a tool, so AI Agent nodes can call it directly

## Resources

- [Parse for n8n](https://parse.conversiontools.io/integrations/n8n) - setup walkthrough and example workflows
- [Parse documentation](https://parse.conversiontools.io/docs/quickstart)
- [API reference](https://parse.conversiontools.io/docs/api/extract)
- [Use cases](https://parse.conversiontools.io/use-cases)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## Support

Issues and feature requests: [GitHub issues](https://github.com/conversiontools/n8n-nodes-parse-conversiontools/issues), or email info@conversiontools.io.

## License

[MIT](LICENSE)
