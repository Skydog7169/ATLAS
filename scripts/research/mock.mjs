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
        const searchBlock = { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: seenUrl, title: 'Mock result' }] };
        const usage = { input_tokens: 12000, output_tokens: 600, cache_read_input_tokens: 0 };
        let parsed;
        if (prompt.startsWith('Conflict:')) {
          // Every other conflict reports a material change so both branches run.
          const changed = n % 2 === 1;
          parsed = {
            changed,
            intensity: 'high',
            status: changed
              ? 'Mock development: on 1 October 2026 fighting intensified around the capital after talks collapsed, and both sides reported heavy casualties. Humanitarian access remained blocked through the first week of October.'
              : 'No material change since the previous assessment; positions and diplomacy as previously described.',
            sources: [
              { name: 'Al Jazeera: mock article', url: seenUrl },
              { name: 'Invented', url: 'https://not-in-results.example/x' },
            ],
            confidence: 'medium',
            note: changed ? 'mock note for reviewer' : '',
          };
        } else if (prompt.startsWith('Here are the current membership lists')) {
          parsed = { changes: [], note: 'mock: no sourced membership changes found' };
        } else if (prompt.startsWith('Country:')) {
          parsed = { known: true, date: '2027-05-15', deadline: false, type: 'legislative', note: 'mock', source: { name: 'Al Jazeera: mock article', url: seenUrl } };
        } else {
          parsed = { candidates: [] };
        }
        return { stop_reason: 'end_turn', content: [searchBlock, { type: 'text', text: JSON.stringify(parsed) }], parsed_output: parsed, usage };
      },
    },
  };
}
