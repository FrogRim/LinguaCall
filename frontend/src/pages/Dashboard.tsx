import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Text, Button } from '../components/tds';
import { api } from '../api/client';
import { HarnessCard } from '../components/HarnessCard';

interface Harness {
  id: string;
  ticker: string;
  summary: string;
  active: boolean;
}

export function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: harnesses = [] } = useQuery({
    queryKey: ['harnesses'],
    queryFn: api.getHarnesses,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.toggleHarness(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['harnesses'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteHarness(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['harnesses'] }),
  });

  return (
    <div style={{ padding: 16, maxWidth: 480, margin: '0 auto' }}>
      <Text typography="title2" style={{ marginBottom: 16 }}>내 하니스</Text>
      {(harnesses as Harness[]).length === 0 ? (
        <Text typography="body2" color="secondary">
          아직 하니스가 없어요. 하나 만들어볼까요?
        </Text>
      ) : (
        (harnesses as Harness[]).map((h) => (
          <HarnessCard
            key={h.id}
            harness={h}
            onToggle={(id, active) => toggleMutation.mutate({ id, active })}
            onDelete={(id) => deleteMutation.mutate(id)}
          />
        ))
      )}
      <Button
        variant="primary"
        size="large"
        style={{ marginTop: 24, width: '100%' }}
        onClick={() => navigate('/builder')}
      >
        새 하니스 만들기
      </Button>
    </div>
  );
}
