'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Download,
  RefreshCcw,
  Phone,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

interface ProgressData {
  surveyId: string;
  status: string;
  totalContacts: number;
  completed: number;
  failed: number;
  pending: number;
  progress: {
    percentage: number;
    completed: number;
    total: number;
  };
}

interface Props {
  surveyId: string;
  fileName: string;
  totalContacts: number;
  onStartCalls?: () => void;
}

export function SurveyProgress({
  surveyId,
  fileName,
  totalContacts,
  onStartCalls
}: Props) {
  const API =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'https://call-agent-envo.onrender.com';

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const timer = useRef<NodeJS.Timeout | null>(null);

  const stopAuto = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const fetchProgress = async (manual = false) => {
    try {
      if (manual) setRefreshing(true);

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/progress?t=${Date.now()}`,
        {
          cache: 'no-store'
        }
      );

      const json = await res.json();

      setData(json);

      if (json.pending === 0) {
        stopAuto();
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const startAuto = () => {
    stopAuto();

    timer.current = setInterval(() => {
      fetchProgress();
    }, 3000);
  };

  useEffect(() => {
    fetchProgress(true);
    startAuto();

    return () => stopAuto();
  }, [surveyId]);

  const startCalls = async () => {
    setStarting(true);

    await fetch(`${API}/api/surveys/${surveyId}/start-calls`, {
      method: 'POST'
    });

    await fetchProgress(true);
    startAuto();

    onStartCalls?.();

    setStarting(false);
  };

  const downloadExcel = () => {
    window.open(
      `${API}/api/surveys/${surveyId}/download?t=${Date.now()}`,
      '_blank'
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex gap-3 items-center">
          <Spinner className="h-5 w-5" />
          Loading...
        </CardContent>
      </Card>
    );
  }

  const total = data?.totalContacts || totalContacts;
  const completed = data?.completed || 0;
  const failed = data?.failed || 0;
  const pending = data?.pending || 0;
  const percent = data?.progress?.percentage || 0;
  const status = data?.status || 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Progress</CardTitle>
        <CardDescription>{fileName}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <div className="text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs">Total</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {completed}
            </div>
            <div className="text-xs">Completed</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {failed}
            </div>
            <div className="text-xs">Failed</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {pending}
            </div>
            <div className="text-xs">Pending</div>
          </div>

        </div>

        <Progress value={percent} />

        {status === 'in_progress' && (
          <Alert>
            <AlertDescription>
              Calls running... auto refreshing.
            </AlertDescription>
          </Alert>
        )}

        {status === 'completed' && (
          <Alert>
            <AlertDescription>
              Survey completed successfully.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-3">

          {status === 'pending' && (
            <Button
              onClick={startCalls}
              disabled={starting}
            >
              <Phone className="w-4 h-4 mr-2" />
              {starting ? 'Starting...' : 'Start Calling'}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => fetchProgress(true)}
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {(completed > 0 || failed > 0 || status === 'completed') && (
            <Button
              variant="outline"
              onClick={downloadExcel}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          )}

        </div>
      </CardContent>
    </Card>
  );
}