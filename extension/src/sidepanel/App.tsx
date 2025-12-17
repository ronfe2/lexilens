import { useEffect } from 'react';

function App() {
  useEffect(() => {
    console.log('LexiLens sidepanel loaded');
  }, []);

  return (
    <div className="h-full w-full bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
            LexiLens
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Select a word to start learning
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;
