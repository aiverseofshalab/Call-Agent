'use client';

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

import {
  Alert,
  AlertDescription
} from '@/components/ui/alert';

import {
  Loader2,
  Phone,
  Download,
  RefreshCw,
  Eye,
  X
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
}

export function SurveyProgress({
  surveyId,
  fileName,
  totalContacts
}: Props) {
  const API =
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    'https://call-agent-envo.onrender.com';

  const [data, setData] =
    useState<ProgressData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [starting, setStarting] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [viewerOpen, setViewerOpen] =
    useState(false);

  const [sheetRows, setSheetRows] =
    useState<any[][]>([]);

  const [sheetLoading, setSheetLoading] =
    useState(false);

  const timer =
    useRef<NodeJS.Timeout | null>(null);

  // ===============================
  // FETCH PROGRESS
  // ===============================
  const fetchProgress = async (
    manual = false
  ) => {
    try {
      if (manual) setRefreshing(true);

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/progress?t=${Date.now()}`,
        {
          cache: 'no-store'
        }
      );

      const json =
        await res.json();

      setData(json);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ===============================
  // AUTO REFRESH
  // ===============================
  useEffect(() => {
    fetchProgress(true);

    timer.current = setInterval(
      () => {
        fetchProgress();
      },
      3000
    );

    return () => {
      if (timer.current)
        clearInterval(timer.current);
    };
  }, [surveyId]);

  // ===============================
  // START CALLS
  // ===============================
  const startCalls = async () => {
    setStarting(true);

    await fetch(
      `${API}/api/surveys/${surveyId}/start-calls`,
      {
        method: 'POST'
      }
    );

    await fetchProgress(true);

    setStarting(false);
  };

  // ===============================
  // DOWNLOAD REPORT
  // ===============================
  const downloadSheet = () => {
    window.open(
      `${API}/api/surveys/${surveyId}/download?t=${Date.now()}`,
      '_blank'
    );
  };

  // ===============================
  // VIEW SHEET
  // ===============================
  const openViewer = async () => {
    try {
      setViewerOpen(true);
      setSheetLoading(true);

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/download?t=${Date.now()}`
      );

      const blob =
        await res.blob();

      const buffer =
        await blob.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: 'array'
        });

      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rows =
        XLSX.utils.sheet_to_json(
          firstSheet,
          {
            header: 1
          }
        );

      setSheetRows(rows as any[][]);
    } catch (error) {
      console.log(error);
    } finally {
      setSheetLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-[#0f1117] border-white/10 text-white rounded-2xl">
        <CardContent className="py-10 flex justify-center gap-3">
          <Loader2 className="animate-spin w-5 h-5" />
          Loading Dashboard...
        </CardContent>
      </Card>
    );
  }

  const total =
    data?.totalContacts ||
    totalContacts;

  const completed =
    data?.completed || 0;

  const failed =
    data?.failed || 0;

  const pending =
    data?.pending || 0;

  const percent =
    data?.progress
      ?.percentage || 0;

  const status =
    data?.status ||
    'pending';

  const stats = [
    ['Total', total],
    ['Completed', completed],
    ['Failed', failed],
    ['Pending', pending]
  ];

  return (
    <>
      <Card className="bg-[#0f1117] border-white/10 text-white rounded-2xl shadow-2xl overflow-hidden">

        <div className="h-1 bg-gradient-to-r from-zinc-700 via-white to-zinc-700" />

        <CardHeader>
          <CardTitle className="text-2xl">
            Survey Agent 101
          </CardTitle>

          <CardDescription className="text-zinc-400 truncate">
            {fileName}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">

          {/* STATS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div
                key={s[0]}
                className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
              >
                <p className="text-xs text-zinc-400">
                  {s[0]}
                </p>

                <p className="text-2xl font-semibold mt-1">
                  {s[1]}
                </p>
              </div>
            ))}
          </div>

          {/* PROGRESS */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>Progress</span>
              <span>{percent}%</span>
            </div>

            <Progress
              value={percent}
              className="h-2 bg-white/10"
            />
          </div>

          {/* STATUS */}
          {status ===
            'in_progress' && (
            <Alert className="border-white/10 bg-white/5 text-zinc-300">
              <AlertDescription>
                Live campaign running...
              </AlertDescription>
            </Alert>
          )}

          {status ===
            'completed' && (
            <Alert className="border-green-500/20 bg-green-500/10 text-green-300">
              <AlertDescription>
                Campaign completed.
              </AlertDescription>
            </Alert>
          )}

          {/* BUTTONS */}
          <div className="grid md:grid-cols-4 gap-3">

            {status ===
              'pending' && (
              <Button
                onClick={
                  startCalls
                }
                disabled={
                  starting
                }
                className="bg-white text-black hover:bg-zinc-200"
              >
                <Phone className="w-4 h-4 mr-2" />
                {starting
                  ? 'Starting...'
                  : 'Start Calling'}
              </Button>
            )}

            <Button
              onClick={() =>
                fetchProgress(true)
              }
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button
              onClick={
                openViewer
              }
              className="bg-white/10 hover:bg-white/15 border border-white/10"
            >
              <Eye className="w-4 h-4 mr-2" />
              Sheet Viewer
            </Button>

            <Button
              onClick={
                downloadSheet
              }
              className="bg-white text-black hover:bg-zinc-200"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>

          </div>
        </CardContent>
      </Card>

      {/* SHEET VIEWER MODAL */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="w-full max-w-7xl h-[85vh] bg-[#0f1117] border border-white/10 rounded-2xl overflow-hidden flex flex-col">

            <div className="p-4 border-b border-white/10 flex justify-between items-center text-white">
              <h2 className="font-semibold text-lg">
                Sheet Viewer
              </h2>

              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setViewerOpen(
                    false
                  )
                }
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4">

              {sheetLoading ? (
                <div className="text-white flex items-center gap-3">
                  <Loader2 className="animate-spin w-5 h-5" />
                  Loading Sheet...
                </div>
              ) : (
                <table className="w-full text-sm text-white border-collapse">
                  <tbody>
                    {sheetRows.map(
                      (
                        row,
                        i
                      ) => (
                        <tr
                          key={i}
                          className="border-b border-white/10"
                        >
                          {row.map(
                            (
                              cell,
                              j
                            ) => (
                              <td
                                key={j}
                                className={`px-3 py-2 whitespace-nowrap ${
                                  i === 0
                                    ? 'font-semibold bg-white/10'
                                    : ''
                                }`}
                              >
                                {cell}
                              </td>
                            )
                          )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}