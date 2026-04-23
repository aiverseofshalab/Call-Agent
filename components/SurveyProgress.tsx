'use client';

import { useEffect, useState } from 'react';
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
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'https://call-agent-envo.onrender.com';

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API}/api/surveys/${surveyId}/progress`, {
        cache: 'no-store'
      });

      if (!res.ok) throw new Error('Failed to fetch progress');

      const data = await res.json();
      setProgress(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch progress');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();

    const timer = setInterval(() => {
      fetchProgress();
    }, 3000);

    return () => clearInterval(timer);
  }, [surveyId]);

  const handleStartCalls = async () => {
    try {
      setIsStarting(true);
      setError('');

      const res = await fetch(`${API}/api/surveys/${surveyId}/start-calls`, {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Failed to start calls');

      await fetchProgress();
      onStartCalls?.();
    } catch (err: any) {
      setError(err.message || 'Failed to start calls');
    } finally {
      setIsStarting(false);
    }
  };

  const handleDownload = () => {
    window.open(`${API}/api/surveys/${surveyId}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="py-10 flex items-center justify-center gap-3 text-white">
          <Spinner className="h-5 w-5" />
          Loading survey...
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
    <Card className="bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle>Survey Progress</CardTitle>
        <CardDescription className="text-slate-300">
          {fileName}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{total}</div>
            <div className="text-xs text-slate-400 mt-1">Total Contacts</div>
          </div>

          <div className="bg-green-950 rounded-lg p-4 text-center">
            <div className="flex justify-center items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <div className="text-2xl font-bold text-green-400">
                {completed}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">Completed</div>
          </div>

          <div className="bg-red-950 rounded-lg p-4 text-center">
            <div className="flex justify-center items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <div className="text-2xl font-bold text-red-400">{failed}</div>
            </div>
            <div className="text-xs text-slate-400 mt-1">Failed</div>
          </div>

          <div className="bg-yellow-950 rounded-lg p-4 text-center">
            <div className="flex justify-center items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <div className="text-2xl font-bold text-yellow-400">
                {pending}
              </div>
            </div>
            <div className="text-xs text-slate-400 mt-1">Pending</div>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Call Progress</span>
            <span>{percent}%</span>
          </div>

          <Progress value={percent} className="h-3" />

          <div className="text-xs text-slate-400">
            {completed + failed} of {total} processed
          </div>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Buttons */}
        <div className="grid gap-3 sm:grid-cols-3">
          {progress?.status === 'pending' && (
            <Button
              onClick={handleStartCalls}
              disabled={isStarting}
              className="w-full"
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
            onClick={fetchProgress}
            className="w-full text-black"
          >
            <RefreshCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          {(completed > 0 || failed > 0) && (
            <Button
              variant="outline"
              onClick={handleDownload}
              className="w-full text-black"
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