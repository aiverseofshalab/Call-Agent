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
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  GraduationCap,
  Briefcase
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

  const [sheetData, setSheetData] =
    useState<{
      headers: string[];
      rows: any[][];
    }>({ headers: [], rows: [] });

  const [sheetLoading, setSheetLoading] =
    useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const timer =
    useRef<NodeJS.Timeout | null>(null);

  // ==========================================
  // FETCH LIVE DASHBOARD DATA
  // ==========================================
  const fetchProgress = async (
    manual = false
  ) => {
    try {
      if (manual)
        setRefreshing(true);

      const res = await fetch(
        `${API}/api/surveys/${surveyId}/progress?ts=${Date.now()}`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control':
              'no-cache, no-store, must-revalidate',
            Pragma:
              'no-cache',
            Expires: '0'
          }
        }
      );

      if (!res.ok)
        throw new Error(
          'Failed to fetch progress'
        );

      const json =
        await res.json();

      setData({
        ...json
      });

      if (
        json.status ===
          'completed' ||
        json.pending === 0
      ) {
        if (timer.current) {
          clearInterval(
            timer.current
          );
          timer.current =
            null;
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ==========================================
  // AUTO REFRESH EVERY 2 SEC
  // ==========================================
  useEffect(() => {
    fetchProgress(true);

    timer.current =
      setInterval(() => {
        fetchProgress();
      }, 2000);

    return () => {
      if (timer.current) {
        clearInterval(
          timer.current
        );
      }
    };
  }, [surveyId]);

  // ==========================================
  // START CALLING
  // ==========================================
  const startCalls =
    async () => {
      try {
        setStarting(true);

        await fetch(
          `${API}/api/surveys/${surveyId}/start-calls`,
          {
            method:
              'POST'
          }
        );

        await fetchProgress(
          true
        );

        if (!timer.current) {
          timer.current =
            setInterval(
              () =>
                fetchProgress(),
              2000
            );
        }
      } catch (error) {
        console.log(error);
      } finally {
        setStarting(false);
      }
    };

  // ==========================================
  // DOWNLOAD FINAL REPORT
  // ==========================================
  const downloadSheet =
    () => {
      window.open(
        `${API}/api/surveys/${surveyId}/download?ts=${Date.now()}`,
        '_blank'
      );
    };

  // ==========================================
  // PROFESSIONAL SHEET VIEWER
  // ==========================================
  const openViewer =
    async () => {
      try {
        setViewerOpen(true);
        setSheetLoading(true);

        const res =
          await fetch(
            `${API}/api/surveys/${surveyId}/download?ts=${Date.now()}`,
            {
              cache:
                'no-store'
            }
          );

        const blob =
          await res.blob();

        const buffer =
          await blob.arrayBuffer();

        const workbook =
          XLSX.read(
            buffer,
            {
              type:
                'array'
            }
          );

        const sheet =
          workbook.Sheets[
            workbook
              .SheetNames[0]
          ];

        const rows =
          XLSX.utils.sheet_to_json(
            sheet,
            {
              header: 1,
              defval: ''
            }
          ) as any[][];

        const headers = rows[0] || [];
        const dataRows = rows.slice(1);

        setSheetData({
          headers,
          rows: dataRows
        });
      } catch (error) {
        console.log(error);
      } finally {
        setSheetLoading(false);
      }
    };

  // ==========================================
  // GET STATUS STYLES
  // ==========================================
  const getStatusStyle = (status: string) => {
    const s = status?.toUpperCase() || '';
    if (s === 'COMPLETED') {
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', icon: CheckCircle };
    }
    if (s === 'CANCELED') {
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', icon: XCircle };
    }
    if (s === 'FAILED') {
      return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: AlertCircle };
    }
    if (s === 'BUSY' || s === 'NO-ANSWER') {
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock };
    }
    return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: Clock };
  };

  // ==========================================
  // GET COURSE STYLE
  // ==========================================
  const getCourseStyle = (course: string) => {
    const c = course?.toUpperCase() || '';
    if (c === 'INTERESTED') {
      return 'text-green-400 font-semibold';
    }
    if (['SCIENCE', 'COMMERCE', 'ARTS', 'OTHER'].includes(c)) {
      return 'text-red-400 font-semibold';
    }
    return 'text-gray-400';
  };

  // ==========================================
  // GET MATH STYLE
  // ==========================================
  const getMathStyle = (value: string) => {
    const v = value?.toUpperCase() || '';
    if (v === 'YES') {
      return 'text-green-400 font-semibold';
    }
    if (v === 'NO') {
      return 'text-red-400 font-semibold';
    }
    return 'text-gray-400';
  };

  // ==========================================
  // SORT & FILTER ROWS
  // ==========================================
  const filteredRows = sheetData.rows.filter(row => {
    if (!searchTerm) return true;
    return row.some(cell => 
      String(cell).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const sortedRows = [...filteredRows];
  if (sortColumn !== null) {
    sortedRows.sort((a, b) => {
      const aVal = String(a[sortColumn] || '');
      const bVal = String(b[sortColumn] || '');
      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });
  }

  const handleSort = (colIndex: number) => {
    if (sortColumn === colIndex) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(colIndex);
      setSortDirection('asc');
    }
  };

  // ==========================================
  // LOADING UI
  // ==========================================
  if (loading) {
    return (
      <Card className="bg-[#0f1117] border-white/10 text-white rounded-2xl">
        <CardContent className="py-10 flex items-center justify-center gap-3">
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
    ['Total', total, 'text-cyan-400'],
    ['Completed', completed, 'text-green-400'],
    ['Failed', failed, 'text-red-400'],
    ['Pending', pending, 'text-yellow-400']
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
            {stats.map(
              (
                [label, value, colorClass]
              ) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                >
                  <p className="text-xs text-zinc-400">
                    {label}
                  </p>

                  <p className={`text-2xl font-semibold mt-1 ${colorClass}`}>
                    {value}
                  </p>
                </div>
              )
            )}
          </div>

          {/* PROGRESS */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-zinc-400">
              <span>
                Progress
              </span>
              <span>
                {percent}%
              </span>
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

          {/* ACTIONS */}
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
                fetchProgress(
                  true
                )
              }
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  refreshing
                    ? 'animate-spin'
                    : ''
                }`}
              />
              Refresh
            </Button>

            <Button
              onClick={
                openViewer
              }
              className="bg-white/10 border border-white/10 hover:bg-white/15"
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

      {/* PROFESSIONAL SHEET VIEWER MODAL */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-5">

          <div className="w-full max-w-7xl h-[90vh] bg-[#0a0c10] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl">

            {/* Header */}
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f1117]">
              <div>
                <h2 className="text-white font-bold text-xl">
                  Survey Results Viewer
                </h2>
                <p className="text-zinc-500 text-sm mt-1">
                  {sheetData.rows.length} records found
                </p>
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setViewerOpen(false)
                }
                className="hover:bg-white/10"
              >
                <X className="w-5 h-5 text-white" />
              </Button>
            </div>

            {/* Search Bar */}
            <div className="p-4 border-b border-white/10 bg-[#0f1117]">
              <input
                type="text"
                placeholder="Search by name, phone, course, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/20"
              />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-4">
              {sheetLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3 text-white">
                    <Loader2 className="animate-spin w-6 h-6" />
                    Loading survey data...
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="sticky top-0 bg-[#0a0c10]">
                      <tr className="border-b border-white/10">
                        {sheetData.headers.map((header, idx) => (
                          <th
                            key={idx}
                            onClick={() => handleSort(idx)}
                            className="px-4 py-3 text-left text-zinc-400 font-semibold text-xs uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                          >
                            {header}
                            {sortColumn === idx && (
                              <span className="ml-2">
                                {sortDirection === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((row, rowIdx) => {
                        const mathValue = row[2] || '';
                        const courseValue = row[3] || '';
                        const statusValue = row[4] || '';
                        const statusStyle = getStatusStyle(statusValue);
                        const StatusIcon = statusStyle.icon;

                        return (
                          <tr
                            key={rowIdx}
                            className="border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            {row.map((cell, colIdx) => {
                              let cellClass = "px-4 py-3 whitespace-nowrap";
                              
                              if (colIdx === 2) {
                                cellClass += ` ${getMathStyle(cell)}`;
                              } else if (colIdx === 3) {
                                cellClass += ` ${getCourseStyle(cell)}`;
                              } else if (colIdx === 4) {
                                return (
                                  <td key={colIdx} className="px-4 py-3 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} border`}>
                                      <StatusIcon className="w-3 h-3" />
                                      {cell || '-'}
                                    </span>
                                  </td>
                                );
                              } else if (colIdx === 0 || colIdx === 1) {
                                cellClass += " text-white";
                              } else {
                                cellClass += " text-zinc-300";
                              }
                              
                              return (
                                <td key={colIdx} className={cellClass}>
                                  {cell || '-'}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {sortedRows.length === 0 && (
                    <div className="text-center py-20 text-zinc-500">
                      No matching records found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-[#0f1117] flex justify-between items-center">
              <div className="text-xs text-zinc-500">
                Showing {sortedRows.length} of {sheetData.rows.length} entries
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadSheet}
                  className="border-white/20 hover:bg-white/10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to Excel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setViewerOpen(false)}
                  className="hover:bg-white/10"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}