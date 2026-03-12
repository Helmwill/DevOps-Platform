import ContainerTable from './components/ContainerTable';
import StatsPanel from './components/StatsPanel';

export default function App() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>DevOps Platform</h1>
      <StatsPanel />
      <ContainerTable />
    </main>
  );
}
