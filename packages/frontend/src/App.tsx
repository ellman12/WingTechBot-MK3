import { useRandomQuote } from './hooks/useRandomQuote';
import { useCounterStore } from './stores/counterStore';

function App() {
  const { count, increment, decrement, reset } = useCounterStore();
  const { data: quote, isLoading, error, refetch } = useRandomQuote();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-8 shadow-xl">
        <div className="text-center">
          <h1 className="mb-8 text-3xl font-bold text-gray-900">WingTechBot MK3</h1>

          <div className="space-y-6">
            <div className="rounded-lg bg-gray-50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-700">Counter Example</h2>
              <div className="mb-6 text-4xl font-bold text-indigo-600">{count}</div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={decrement}
                  className="focus:ring-opacity-50 rounded-lg bg-red-500 px-4 py-2 text-white transition-colors hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:outline-none"
                >
                  -1
                </button>

                <button
                  onClick={reset}
                  className="focus:ring-opacity-50 rounded-lg bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:outline-none"
                >
                  Reset
                </button>

                <button
                  onClick={increment}
                  className="focus:ring-opacity-50 rounded-lg bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:outline-none"
                >
                  +1
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-6">
              <h2 className="mb-4 text-xl font-semibold text-gray-700">
                Random Quote (TanStack Query)
              </h2>

              {isLoading && (
                <div className="text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-gray-600">Loading quote...</p>
                </div>
              )}

              {error && (
                <div className="text-center text-red-600">
                  <p>Failed to load quote</p>
                  <button
                    onClick={() => refetch()}
                    className="mt-2 rounded bg-red-500 px-3 py-1 text-sm text-white hover:bg-red-600"
                  >
                    Retry
                  </button>
                </div>
              )}

              {quote && !isLoading && (
                <div className="text-center">
                  <blockquote className="mb-2 text-gray-700 italic">"{quote.content}"</blockquote>
                  <cite className="text-sm text-gray-600">— {quote.author}</cite>
                  <button
                    onClick={() => refetch()}
                    className="mx-auto mt-3 block rounded bg-indigo-500 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-600"
                  >
                    New Quote
                  </button>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600">
              <p>✅ React + Vite</p>
              <p>✅ Tailwind CSS</p>
              <p>✅ Zustand State Management</p>
              <p>✅ TanStack Query</p>
              <p>✅ Storybook</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
