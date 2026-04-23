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

  // ===============================
  // FETCH PROGRESS
  // ===============================
  const fetchProgress = async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/progress?t=${Date.now()}`,
        {
          method: 'GET',
          cache: 'no-store'
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch progress');
      }

      const data = await res.json();

      setProgress(data);
      setError('');

      // AUTO STOP REFRESH WHEN ALL DONE
      if (
        data.pending === 0 ||
        data.status === 'completed' ||
        data.status === 'finished'
      ) {
        stopAutoRefresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch progress');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // ===============================
  // AUTO REFRESH EVERY 5 SEC
  // ===============================
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

  // ===============================
  // INITIAL LOAD
  // ===============================
  useEffect(() => {
    fetchProgress(true);
    startAutoRefresh();

    return () => stopAutoRefresh();
  }, [surveyId]);

  // ===============================
  // START CALLS
  // ===============================
  const handleStartCalls = async () => {
    try {
      setIsStarting(true);
      setError('');

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/start-calls`,
        {
          method: 'POST'
        }
      );

      if (!res.ok) {
        throw new Error('Failed to start calls');
      }

      await fetchProgress(true);
      startAutoRefresh();
      onStartCalls?.();
    } catch (err: any) {
      setError(err.message || 'Failed to start calls');
    } finally {
      setIsStarting(false);
    }
  };

  // ===============================
  // DOWNLOAD
  // ===============================
  const handleDownload = () => {
    window.open(
      `${API}/api/surveys/${surveyId}/download?t=${Date.now()}`,
      '_blank'
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-700 text-white">
        <CardContent className="py-10 flex items-center justify-center gap-3">
          <Spinner className="h-5 w-5" />
          Loading Survey...
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
    <Card className="bg-slate-900 border-slate-700 text-white">
      <CardHeader>
        <CardTitle>Survey Progress</CardTitle>
        <CardDescription className="text-slate-400">
          {fileName}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* COUNTERS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl bg-slate-800 p-4 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-slate-400 mt-1">
              Total Contacts
            </div>
          </div>

          <div className="rounded-xl bg-green-950 p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <div className="text-2xl font-bold text-green-400">
                {completed}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Completed
            </div>
          </div>

          <div className="rounded-xl bg-red-950 p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <div className="text-2xl font-bold text-red-400">
                {failed}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Failed
            </div>
          </div>

          <div className="rounded-xl bg-yellow-950 p-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <div className="text-2xl font-bold text-yellow-400">
                {pending}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Pending
            </div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Calling Progress</span>
            <span>{percent}%</span>
          </div>

          <Progress value={percent} className="h-3" />

          <div className="text-xs text-slate-400">
            {completed + failed} of {total} processed
          </div>
        </div>

        {/* STATUS */}
        {progress?.status === 'in_progress' && (
          <Alert>
            <AlertDescription>
              Calls are running. Dashboard auto-refreshes every 5 seconds.
            </AlertDescription>
          </Alert>
        )}

        {progress?.status === 'completed' && (
          <Alert>
            <AlertDescription>
              Survey completed successfully. Download updated Excel now.
            </AlertDescription>
          </Alert>
        )}

        {/* ERROR */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* BUTTONS */}
        <div className="grid gap-3 sm:grid-cols-3">
          {progress?.status === 'pending' && (
            <Button
              onClick={handleStartCalls}
              disabled={isStarting}
            >
              {isStarting ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Start Calling
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => fetchProgress(true)}
            className="text-black"
          >
            {isRefreshing ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Refreshing
              </>
            ) : (
              <>
                <RefreshCcw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>

          {(completed > 0 || failed > 0) && (
            <Button
              variant="outline"
              onClick={handleDownload}
              className="text-black"
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