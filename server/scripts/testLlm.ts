import { testLlmConnection } from '../services/llmClient.ts';

async function main() {
  console.log('Testing LLM connection...');
  const res = await testLlmConnection();
  console.log('Result:', JSON.stringify(res));
}

main().catch((err) => {
  console.error('Fatal test error:', err);
});
