'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Download,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCcw
} from 'lucide-react';

interface ProgressData {
  success?: boolean;
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

interface SurveyProgressProps {
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
}: SurveyProgressProps) {
  const API =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'https://call-agent-envo.onrender.com';

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchProgress = async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/progress?t=${Date.now()}`,
        { cache: 'no-store' }
      );

      const data = await res.json();

      setProgress(data);
      setError('');

      if (data.pending === 0) stopAutoRefresh();
    } catch (err: any) {
      setError(err.message || 'Failed to fetch progress');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const startAutoRefresh = () => {
    stopAutoRefresh();

    timerRef.current = setInterval(() => {
      fetchProgress();
    }, 5000);
  };

  const stopAutoRefresh = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    fetchProgress(true);
    startAutoRefresh();

    return () => stopAutoRefresh();
  }, [surveyId]);

  const handleStartCalls = async () => {
    try {
      setIsStarting(true);

      await fetch(`${API}/api/surveys/${surveyId}/start-calls`, {
        method: 'POST'
      });

      await fetchProgress(true);
      startAutoRefresh();

      onStartCalls?.();
    } finally {
      setIsStarting(false);
    }
  };

  const handleDownload = () => {
    window.open(
      `${API}/api/surveys/${surveyId}/download?t=${Date.now()}`,
      '_blank'
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          Loading...
        </CardContent>
      </Card>
    );
  }

  const total = progress?.totalContacts || totalContacts;
  const completed = progress?.completed || 0;
  const failed = progress?.failed || 0;
  const pending = progress?.pending ?? total;
  const percent = progress?.progress?.percentage || 0;

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
            <div className="text-2xl font-bold text-green-600">{completed}</div>
            <div className="text-xs">Completed</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <div className="text-xs">Failed</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{pending}</div>
            <div className="text-xs">Pending</div>
          </div>
        </div>

        <Progress value={percent} />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {progress?.status === 'pending' && (
            <Button onClick={handleStartCalls} disabled={isStarting}>
              <Phone className="w-4 h-4 mr-2" />
              {isStarting ? 'Starting...' : 'Start Calling'}
            </Button>
          )}

          <Button variant="outline" onClick={() => fetchProgress(true)}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>

          {(completed > 0 || failed > 0) && (
            <Button variant="outline" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}