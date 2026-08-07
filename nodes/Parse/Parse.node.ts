import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const BASE_URL = 'https://api-parse.conversiontools.io/v1';

/**
 * Extraction is asynchronous by default: submitting returns an id immediately
 * and the document is processed in the background. A dense document can take
 * several minutes, which is far longer than any HTTP client will hold a
 * connection open, so the node polls rather than asking the API to block.
 */
const POLL_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_SECONDS = 300;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Parse implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Parse',
		name: 'parse',
		icon: 'file:parse.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description:
			'Extract structured data from invoices, receipts, statements and other documents',
		defaults: {
			name: 'Parse',
		},
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [
			{
				name: 'parseApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Extract Document',
						value: 'extract',
						description: 'Extract structured data from a document',
						action: 'Extract a document',
					},
					{
						name: 'Get Extraction',
						value: 'getExtraction',
						description: 'Fetch a previous extraction by ID',
						action: 'Get an extraction',
					},
					{
						name: 'Export Extraction',
						value: 'exportExtraction',
						description: 'Export an extraction to CSV, Excel or JSON',
						action: 'Export an extraction',
					},
					{
						name: 'List Schemas',
						value: 'listSchemas',
						description: 'List the saved schemas on this account',
						action: 'List schemas',
					},
					{
						name: 'Get Usage',
						value: 'getUsage',
						description: 'Pages used against the monthly allowance',
						action: 'Get usage',
					},
				],
				default: 'extract',
			},

			// ---------------------------------------------------------- extract
			{
				displayName: 'Input Binary Field',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: { show: { operation: ['extract'] } },
				description:
					'Name of the binary field holding the document to extract',
			},
			{
				displayName: 'Schema',
				name: 'schemaId',
				type: 'options',
				// A saved schema is the whole point of the product: the same fields
				// come back in the same shape for every document of a type. Listing
				// them makes that the obvious path instead of a pasted id.
				typeOptions: { loadOptionsMethod: 'getSchemas' },
				default: '',
				displayOptions: { show: { operation: ['extract'] } },
				description:
					'Saved schema to extract against. Leave empty to describe the fields inline instead. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'json',
				default: '',
				displayOptions: { show: { operation: ['extract'] } },
				description:
					'Ad-hoc field definitions, used only when no schema is selected. A JSON array such as [{"name":"invoice_number","type":"string"}].',
			},
			{
				displayName: 'Wait for Completion',
				name: 'waitForCompletion',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['extract'] } },
				description:
					'Whether to wait for the extracted data. Turn off to return the extraction ID immediately and fetch the result later.',
			},
			{
				displayName: 'Timeout (Seconds)',
				name: 'timeout',
				type: 'number',
				default: DEFAULT_TIMEOUT_SECONDS,
				displayOptions: {
					show: { operation: ['extract'], waitForCompletion: [true] },
				},
				description:
					'How long to wait before giving up. Long or dense documents take longer.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add option',
				default: {},
				displayOptions: { show: { operation: ['extract'] } },
				options: [
					{
						displayName: 'Bypass Cache',
						name: 'noCache',
						type: 'boolean',
						default: false,
						description:
							'Whether to re-extract even if this exact document and field set was extracted before. Re-extracting counts against your page allowance.',
					},
					{
						displayName: 'Webhook URL',
						name: 'webhookUrl',
						type: 'string',
						default: '',
						description:
							'URL notified when the extraction finishes. The notification carries the ID and status only, never the extracted content.',
					},
				],
			},

			// ------------------------------------------------- extraction by id
			{
				displayName: 'Extraction ID',
				name: 'extractionId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { operation: ['getExtraction', 'exportExtraction'] },
				},
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'CSV', value: 'csv' },
					{ name: 'Excel', value: 'xlsx' },
					{ name: 'JSON', value: 'json' },
				],
				default: 'csv',
				displayOptions: { show: { operation: ['exportExtraction'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getSchemas(
				this: ILoadOptionsFunctions,
			): Promise<INodePropertyOptions[]> {
				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'parseApi',
					{ method: 'GET', url: `${BASE_URL}/schemas`, json: true },
				)) as IDataObject;

				const schemas = (response.schemas as IDataObject[]) || [];

				return schemas.map((schema) => ({
					name: (schema.name as string) || (schema.id as string),
					value: schema.id as string,
					description: (schema.description as string) || undefined,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let json: IDataObject;

				if (operation === 'extract') {
					json = await extractDocument.call(this, i);
				} else if (operation === 'getExtraction') {
					const id = this.getNodeParameter('extractionId', i) as string;
					json = await request.call(this, 'GET', `/extractions/${id}`);
				} else if (operation === 'exportExtraction') {
					const id = this.getNodeParameter('extractionId', i) as string;
					const format = this.getNodeParameter('format', i) as string;
					json = await request.call(
						this,
						'POST',
						`/extractions/${id}/export`,
						{ format },
					);
				} else if (operation === 'listSchemas') {
					json = await request.call(this, 'GET', '/schemas');
				} else {
					json = await request.call(this, 'GET', '/usage');
				}

				returnData.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

async function request(
	this: IExecuteFunctions,
	method: 'GET' | 'POST',
	path: string,
	body?: IDataObject,
): Promise<IDataObject> {
	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'parseApi',
		{ method, url: `${BASE_URL}${path}`, body, json: true },
	)) as IDataObject;
}

async function extractDocument(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<IDataObject> {
	const binaryPropertyName = this.getNodeParameter(
		'binaryPropertyName',
		itemIndex,
	) as string;
	const schemaId = this.getNodeParameter('schemaId', itemIndex, '') as string;
	const fieldsRaw = this.getNodeParameter('fields', itemIndex, '') as string;
	const waitForCompletion = this.getNodeParameter(
		'waitForCompletion',
		itemIndex,
	) as boolean;
	const options = this.getNodeParameter(
		'options',
		itemIndex,
		{},
	) as IDataObject;

	if (!schemaId && !fieldsRaw) {
		throw new NodeOperationError(
			this.getNode(),
			'Select a schema, or describe the fields to extract.',
			{ itemIndex },
		);
	}

	const binaryData = this.helpers.assertBinaryData(
		itemIndex,
		binaryPropertyName,
	);
	const buffer = await this.helpers.getBinaryDataBuffer(
		itemIndex,
		binaryPropertyName,
	);

	if (!binaryData.fileName) {
		throw new NodeOperationError(
			this.getNode(),
			'The input file has no file name, which Parse needs to detect its type.',
			{ itemIndex },
		);
	}

	const FormDataCtor = (globalThis as { FormData?: typeof FormData }).FormData;
	const BlobCtor = (globalThis as { Blob?: typeof Blob }).Blob;

	if (!FormDataCtor || !BlobCtor) {
		throw new NodeOperationError(
			this.getNode(),
			'This node needs Node.js 18 or newer.',
			{ itemIndex },
		);
	}

	const form = new FormDataCtor();
	form.append(
		'file',
		new BlobCtor([new Uint8Array(buffer)], {
			type: binaryData.mimeType || 'application/octet-stream',
		}),
		binaryData.fileName,
	);

	if (schemaId) {
		form.append('schema_id', schemaId);
	} else {
		// Sent as text because multipart carries no types; the API parses it.
		form.append(
			'fields',
			typeof fieldsRaw === 'string' ? fieldsRaw : JSON.stringify(fieldsRaw),
		);
	}
	if (options.noCache) form.append('no_cache', 'true');
	if (options.webhookUrl) form.append('webhook_url', options.webhookUrl as string);

	const submitted = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'parseApi',
		{ method: 'POST', url: `${BASE_URL}/extract`, body: form, json: true },
	)) as IDataObject;

	const extractionId = submitted.id as string;

	// A repeat of an identical document and field set is served from cache and
	// comes back already finished, with no page charged.
	if (!waitForCompletion || submitted.status === 'completed') {
		return submitted;
	}

	if (!extractionId) {
		throw new NodeOperationError(
			this.getNode(),
			'Parse did not return an extraction ID.',
			{ itemIndex },
		);
	}

	const timeoutSeconds = this.getNodeParameter(
		'timeout',
		itemIndex,
		DEFAULT_TIMEOUT_SECONDS,
	) as number;
	const deadline = Date.now() + timeoutSeconds * 1000;

	// Poll on status, never on elapsed time: "processing" is the only thing that
	// means not-finished, and a slow document is not a failed one.
	while (Date.now() < deadline) {
		await sleep(POLL_INTERVAL_MS);

		const current = await request.call(
			this,
			'GET',
			`/extractions/${extractionId}`,
		);

		if (current.status === 'completed') return current;

		if (current.status === 'failed') {
			throw new NodeOperationError(
				this.getNode(),
				`Extraction failed: ${(current.error as string) || 'unknown error'}`,
				{ itemIndex },
			);
		}
	}

	throw new NodeOperationError(
		this.getNode(),
		`Extraction ${extractionId} did not finish within ${timeoutSeconds}s. It may still complete - fetch it later with Get Extraction, or raise the timeout.`,
		{ itemIndex },
	);
}
