import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class ParseApi implements ICredentialType {
	name = 'parseApi';

	displayName = 'Parse API';

	documentationUrl = 'https://parse.conversiontools.io/docs/authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'API key from your Parse dashboard. Create one at <a href="https://parse.conversiontools.io/dashboard/api-keys" target="_blank">parse.conversiontools.io/dashboard/api-keys</a>',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
				'User-Agent': 'parse-n8n/1.0.0',
			},
		},
	};

	// Usage is the cheapest authenticated endpoint: it reads a counter rather
	// than touching a document, so testing a credential costs the user nothing.
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api-parse.conversiontools.io/v1',
			url: '/usage',
		},
	};
}
