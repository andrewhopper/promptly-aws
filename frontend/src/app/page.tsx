import Chat from './components/Chat';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="container mx-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 h-[80vh]">
          <Chat />
        </div>
      </main>
    </div>
  );
}
