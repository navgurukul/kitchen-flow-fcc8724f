import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";

interface SkipRequest {
  id: string;
  profile_id: string;
  queue_position_at_request: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

export default function SkipRequests() {
  const { role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<SkipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<SkipRequest | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (!authLoading && role !== 'coordinator') {
      navigate('/dashboard');
    }
  }, [role, authLoading, navigate]);

  useEffect(() => {
    if (role === 'coordinator') {
      fetchRequests();
    }
  }, [role]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('skip_requests')
        .select(`
          *,
          student:profiles!profile_id (
            full_name,
            email
          )
        `)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      
      const formattedRequests: SkipRequest[] = (data || []).map(req => ({
        id: req.id,
        profile_id: req.profile_id,
        queue_position_at_request: req.queue_position_at_request,
        reason: req.reason,
        status: req.status as 'pending' | 'approved' | 'rejected',
        requested_at: req.requested_at,
        reviewed_by: req.reviewed_by,
        reviewed_at: req.reviewed_at,
        review_notes: req.review_notes,
        profiles: req.student
      }));
      
      setRequests(formattedRequests);
    } catch (error) {
      console.error('Error fetching skip requests:', error);
      toast({
        title: "Error",
        description: "Failed to load skip requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);
      const { data, error } = await supabase.functions.invoke('handle-skip-request', {
        body: {
          requestId: selectedRequest.id,
          action: dialogAction,
          reviewNotes: reviewNotes || undefined
        }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message || `Request ${dialogAction}d successfully`,
      });

      // Refresh the list
      await fetchRequests();
      setShowDialog(false);
      setSelectedRequest(null);
      setReviewNotes('');
    } catch (error: any) {
      console.error('Error processing request:', error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${dialogAction} request`,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const openDialog = (request: SkipRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setDialogAction(action);
    setShowDialog(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const requestDate = new Date(date);
    const diffMs = now.getTime() - requestDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const filteredRequests = requests.filter(req => {
    if (activeTab === 'all') return true;
    return req.status === activeTab;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button
              variant="ghost"
              onClick={() => navigate('/dashboard')}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">Skip Requests Management</h1>
            <p className="text-gray-600 mt-1">Review and manage student skip requests</p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-lg px-4 py-2">
              {pendingCount} Pending
            </Badge>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All ({requests.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({requests.filter(r => r.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="approved">Approved ({requests.filter(r => r.status === 'approved').length})</TabsTrigger>
            <TabsTrigger value="rejected">Rejected ({requests.filter(r => r.status === 'rejected').length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-6">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  No {activeTab !== 'all' ? activeTab : ''} requests found
                </CardContent>
              </Card>
            ) : (
              filteredRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                          {request.profiles.full_name}
                          {getStatusBadge(request.status)}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Position: {request.queue_position_at_request} • {request.profiles.email}
                        </CardDescription>
                      </div>
                      <span className="text-sm text-gray-500">{getTimeAgo(request.requested_at)}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="font-semibold">Reason:</Label>
                      <p className="text-gray-700 mt-1">{request.reason}</p>
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => openDialog(request, 'approve')}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Approve
                        </Button>
                        <Button
                          onClick={() => openDialog(request, 'reject')}
                          variant="destructive"
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {request.status !== 'pending' && request.review_notes && (
                      <div className="bg-gray-50 p-3 rounded-md">
                        <Label className="font-semibold">Review Notes:</Label>
                        <p className="text-gray-700 text-sm mt-1">{request.review_notes}</p>
                        {request.reviewed_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Reviewed {getTimeAgo(request.reviewed_at)}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Confirmation Dialog */}
        <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {dialogAction === 'approve' ? 'Approve Skip Request' : 'Reject Skip Request'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {dialogAction === 'approve' ? (
                  <>
                    <p className="mb-2">
                      <strong>{selectedRequest?.profiles.full_name}</strong> at position{' '}
                      <strong>{selectedRequest?.queue_position_at_request}</strong> will swap positions with the student at position 11.
                    </p>
                    <p className="text-sm text-amber-600">
                      This will move them to position 11 and bring the position 11 student into tomorrow's team.
                    </p>
                  </>
                ) : (
                  <p>
                    Are you sure you want to reject this skip request from{' '}
                    <strong>{selectedRequest?.profiles.full_name}</strong>?
                  </p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="my-4">
              <Label htmlFor="review-notes">Review Notes (Optional)</Label>
              <Textarea
                id="review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add any notes about this decision..."
                className="mt-2"
                rows={3}
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleAction}
                disabled={processing}
                className={dialogAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {processing ? 'Processing...' : dialogAction === 'approve' ? 'Approve & Swap' : 'Reject'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
