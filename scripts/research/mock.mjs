// Offline stand-in for the Anthropic client so the pipeline (guardrails,
// JSON writing, report) can be exercised in CI without an API key.
export function mockClient() {
  let n = 0;
  return {
    messages: {
      async parse({ messages }) {
        n += 1;
        const prompt = messages[0].content;
        const seenUrl = 'https://www.aljazeera.com/news/2026/10/mock-article';
        const seenUrl2 = 'https://apnews.com/article/mock-second-outlet';
        const searchBlock = {
          type: 'web_search_tool_result',
          content: [
            { type: 'web_search_result', url: seenUrl, title: 'Mock result' },
            { type: 'web_search_result', url: seenUrl2, title: 'Mock result from a second outlet' },
          ],
        };
        const usage = { input_tokens: 12000, output_tokens: 600, cache_read_input_tokens: 0 };
        let parsed;
        if (prompt.startsWith('Conflict:') || prompt.startsWith('Unrest:')) {
          const unrestPrompt = prompt.startsWith('Unrest:');
          // Every other conflict reports a material change so both branches run.
          const changed = n % 2 === 1;
          parsed = {
            changed,
            intensity: unrestPrompt ? 'medium' : 'high',
            status: changed
              ? unrestPrompt
                ? 'Mock development: on 1 October 2026 renewed protests drew tens of thousands to the capital after a disputed court ruling, and police made several hundred arrests. Organisers called further marches for the following weekend.'
                : 'Mock development: on 1 October 2026 fighting intensified around the capital after talks collapsed, and both sides reported heavy casualties. Humanitarian access remained blocked through the first week of October.'
              : 'No material change since the previous assessment; positions and diplomacy as previously described.',
            sources: [
              { name: 'Al Jazeera', headline: 'Mock article on fighting near the capital', published: '2026-10-01', url: seenUrl },
              { name: 'Invented', headline: 'Not in the results', published: '2026-10-01', url: 'https://not-in-results.example/x' },
            ],
            confidence: 'medium',
            note: changed ? 'mock note for reviewer' : '',
            peaceEvents: changed && !unrestPrompt
              ? [
                  { date: '2026-10-01', kind: 'talks', summary: 'Mock: mediators convened a first round of talks in Doha on 1 October 2026.', source: { name: 'Al Jazeera: mock article', url: seenUrl } },
                  { date: '2026-10-02', kind: 'ceasefire', summary: 'Mock: an unsourced claim that must be dropped.', source: { name: 'Invented', url: 'https://not-in-results.example/y' } },
                ]
              : [],
          };
        } else if (prompt.startsWith('Chokepoint:')) {
          // Alternate a sourced change and a homepage-only one, which must not be applied.
          const changed = n % 2 === 1;
          parsed = {
            changed: true,
            status: 'disrupted',
            summary: 'Mock: on 1 October 2026 insurers raised war-risk premiums after two tankers were struck, and transits fell by a third.',
            sources: changed ? [{ name: 'AP', headline: 'Mock tanker strikes', published: '2026-10-01', url: seenUrl2 }] : [{ name: 'Reuters', headline: 'Front page', published: '2026-10-01', url: 'https://www.reuters.com/' }],
            note: 'mock chokepoint note',
          };
        } else if (prompt.startsWith('Here are the current membership lists')) {
          parsed = { changes: [], note: 'mock: no sourced membership changes found' };
        } else if (prompt.startsWith('Country:')) {
          parsed = { known: true, date: '2027-05-15', deadline: false, type: 'legislative', note: 'mock', source: { name: 'Al Jazeera: mock article', url: seenUrl } };
        } else if (prompt.startsWith('The map already tracks these unrest episodes')) {
          // New-unrest scan: one candidate that clears the bar and one that does not.
          parsed = {
            candidates: [
              {
                name: 'Mockland rent-cap riots',
                kind: 'riots',
                since: '2026-10',
                countries: ['PRT'],
                city: 'Lisbon',
                location: { lon: -9.14, lat: 38.72 },
                parties: ['Tenant unions and students', 'Government'],
                trigger: 'Mock: the repeal of a rent cap announced on 1 October 2026 set off protest camps that turned into nightly clashes.',
                summary: 'Mock background: protest camps in Lisbon and Porto over housing costs grew into nightly clashes with police within two weeks of the rent-cap repeal.',
                status: 'Mock status: on 17 October 2026 thousands marched in Lisbon and clashes followed near parliament, with dozens of arrests reported. The government has not withdrawn the repeal.',
                intensity: 'medium',
                confidence: 'medium',
                why: 'mock: two outlets, should be added',
                sources: [
                  { name: 'Al Jazeera: mock article', url: seenUrl },
                  { name: 'AP: mock article', url: seenUrl2 },
                ],
              },
              {
                name: 'Mock single-source protests',
                kind: 'protests',
                since: '2026-09',
                countries: ['ESP'],
                city: 'Madrid',
                location: { lon: -3.7, lat: 40.4 },
                parties: ['Tenant unions'],
                trigger: 'Mock: housing decrees voted on 1 October 2026 drew protest camps in several cities.',
                summary: 'Mock background on housing protests that only one outlet has covered so far in these results.',
                status: 'Mock status: protest camps in Madrid and Malaga from 1 to 5 October 2026 drew union backing and talk of a general strike.',
                intensity: 'medium',
                confidence: 'medium',
                why: 'mock: one outlet, should be reported not added',
                sources: [{ name: 'Al Jazeera: mock article', url: seenUrl }],
              },
            ],
          };
        } else {
          // New-conflict scan: nothing to propose.
          parsed = { candidates: [] };
        }
        return { stop_reason: 'end_turn', content: [searchBlock, { type: 'text', text: JSON.stringify(parsed) }], parsed_output: parsed, usage };
      },
    },
  };
}
