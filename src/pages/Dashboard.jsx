import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useLanguage } from '@/context/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import {
  Activity, CheckCircle, Clock, AlertTriangle, FileText, MapPin,
  Tag, ChevronDown, ChevronUp, ShieldCheck, UserCheck, ArrowRight, Sparkles, Gauge,
  UserCog, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiJson } from '@/lib/api';

const StatCard = ({ title, value, icon: Icon, description, colorClass = "text-primary bg-primary/10" }) => (
  <Card className="shadow-sm border-primary/10 transition-all hover:shadow-md bg-card/95 backdrop-blur-sm">
    <CardContent className="p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold">{value}</h3>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className={`p-3 rounded-xl shadow-inner ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const progressColor = (progress) => {
  switch (progress) {
    case 'Resolved': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
    case 'In Progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    default: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400';
  }
};

const getAssignedId = (issue) => {
  if (!issue) return null;
  if (typeof issue.assignedTo === 'string') return issue.assignedTo;
  if (issue.assignedTo && typeof issue.assignedTo === 'object') {
    return issue.assignedTo.$oid || issue.assignedTo._id || issue.assignedTo.id || issue.assignedTo.toString?.();
  }
  return issue.assignedTo;
};

const getIssueReportImage = (issue) => issue?.img || issue?.image || issue?.imageUrl || issue?.proofImage || '';

const getIssueCompletionImage = (issue) => issue?.completionImg || issue?.resolvedImage || '';

const normalizeEntityId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim();
    return normalized || null;
  }
  if (typeof value === 'object') {
    const candidate = value.$oid || value._id || value.id;
    if (candidate !== undefined && candidate !== null) {
      const normalized = String(candidate).trim();
      return normalized || null;
    }
    if (typeof value.toString === 'function') {
      const normalized = String(value.toString()).trim();
      if (normalized && normalized !== '[object Object]') return normalized;
    }
  }
  return null;
};

const resolveImageSrc = (rawSrc = '') => {
  const src = String(rawSrc || '').trim();
  if (!src) return '';
  if (src.startsWith('data:image/')) return src;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (src.startsWith('/')) return src;
  if (src.startsWith('blob:')) return src;
  return `https://${src}`;
};

const EvidenceImage = ({ src, alt, className, hintClassName = 'text-xs text-muted-foreground' }) => {
  const [failed, setFailed] = useState(false);
  const normalizedSrc = resolveImageSrc(src);

  if (!normalizedSrc) {
    return <p className={hintClassName}>No image available.</p>;
  }

  if (failed) {
    return (
      <div className="space-y-1">
        <p className={hintClassName}>Image preview unavailable.</p>
        <a href={normalizedSrc} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
          Open image in new tab
        </a>
      </div>
    );
  }

  return (
    <a href={normalizedSrc} target="_blank" rel="noreferrer" className="block">
      <img
        src={normalizedSrc}
        alt={alt}
        className={className}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </a>
  );
};

const IssueDetailRow = ({ issue, isAuthority = false, showEvidenceImages = true }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { verifyIssue, resolveIssue, adminReviewIssue, fileAppeal } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [completionImg, setCompletionImg] = useState('');
  const [completionFileName, setCompletionFileName] = useState('');
  const [completionDescription, setCompletionDescription] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectMessage, setRejectMessage] = useState('');
  const [adminReviewNote, setAdminReviewNote] = useState('');
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  const handleCompletionFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setResolveError(t('Please select a valid image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setCompletionImg(reader.result || '');
      setCompletionFileName(file.name);
      setResolveError('');
    };
    reader.readAsDataURL(file);
  };

  const handleVerify = async (status) => {
    setSubmitting(true);
    await verifyIssue(issue.id, status, status === 'Rejected' ? rejectMessage : 'User verified via dashboard');
    setSubmitting(false);
    if (status === 'Rejected') {
      setShowRejectForm(false);
      setRejectMessage('');
    }
  };

  const handleAdminReview = async (action = 'review') => {
    setSubmitting(true);
    await adminReviewIssue(issue.id, adminReviewNote, action);
    setSubmitting(false);
    setAdminReviewNote('');
  };

  const handleFileAppeal = async () => {
    if (!appealMessage.trim()) {
      return;
    }
    setAppealSubmitting(true);
    try {
      await fileAppeal(issue.id, appealMessage.trim());
      setShowAppealForm(false);
      setAppealMessage('');
    } catch (e) {
      console.error(e);
    } finally {
      setAppealSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!completionImg.trim() || !completionDescription.trim()) {
      setResolveError(t('Please add both completion image and completion description.'));
      return;
    }
    setSubmitting(true);
    setResolveError('');
    await resolveIssue(issue.id, completionImg.trim(), completionDescription.trim());
    setSubmitting(false);
    setShowResolveForm(false);
    setCompletionImg('');
    setCompletionFileName('');
    setCompletionDescription('');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} layout>
      <Card className={`shadow-sm border-border/70 hover:border-primary/30 transition-all ${issue.priorityLabel === 'Critical' ? 'border-l-4 border-l-red-500' : ''}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex h-12 w-12 rounded-xl bg-secondary items-center justify-center shrink-0 border border-border overflow-hidden">
                {showEvidenceImages && getIssueReportImage(issue)
                  ? <img src={resolveImageSrc(getIssueReportImage(issue))} className="object-contain h-full w-full bg-muted/30 p-1" alt="" />
                  : <FileText className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <h4 className="font-semibold text-base mb-0.5">{t(issue.title)}</h4>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {t(issue.location)}
                  <span className="mx-1">•</span>
                  <Tag className="w-3 h-3" /> {t(issue.category)}
                  {issue.department && <><span className="mx-1">•</span>🏢 {t(issue.department)}</>}
                </p>
                {issue.address && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 italic">📍 {issue.address}</p>
                )}
              </div>
            </div>
            <div className="flex flex-row-reverse sm:flex-row items-center justify-end gap-3">
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase ${progressColor(issue.progress)}`}>
                {issue.progress === 'In Progress' && issue.assignedToName
                  ? `${t('Assigned to')} ${issue.assignedToName}`
                  : t(issue.progress)}
              </span>
              <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 pt-4 border-t border-border/40 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-3">
                       <p className="text-sm text-muted-foreground leading-relaxed italic">"{t(issue.description)}"</p>
                       <div className="flex flex-wrap gap-2">
                         {issue.priorityLabel && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-black uppercase">{t(issue.priorityLabel)}</span>}
                         {issue.isRepeat && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-black uppercase">{t('RECURRING')}</span>}
                       </div>

                    </div>
                    <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('Meta Information')}</p>
                       <div className="text-xs space-y-1.5">
                         <div className="flex justify-between"><span>{t('Votes')}</span><span className="font-bold">👍 {issue.upvotes}</span></div>
                         <div className="flex justify-between"><span>{t('Status')}</span><span className="font-bold">{t(issue.verificationStatus || 'Pending')}</span></div>
                         {issue.deadline && <div className="flex justify-between text-red-600 font-bold"><span>{t('Deadline')}</span><span>{new Date(issue.deadline).toLocaleDateString()}</span></div>}
                       </div>
                    </div>
                  </div>

                  {issue.progress === 'Resolved' && (getIssueCompletionImage(issue) || issue.completionDescription) && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                        {t('Completion Update')}
                      </p>
                      {issue.completionDescription && (
                        <p className="text-xs text-foreground">{t(issue.completionDescription)}</p>
                      )}
                      {getIssueCompletionImage(issue) && (
                        <div>
                          <EvidenceImage
                            src={getIssueCompletionImage(issue)}
                            alt={t('Completion evidence')}
                            className="h-56 w-full max-w-2xl rounded-lg object-contain bg-muted/30 border border-emerald-500/30"
                          />
                          <span className="text-xs text-primary underline mt-1 inline-block">{t('View completion image')}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {issue.auditLogs && issue.auditLogs.length > 0 && (
                     <div className="mt-4 bg-muted/20 rounded-xl p-4 border border-border/40">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                           <ShieldCheck className="w-3 h-3"/> {t('System Audit Log / Chain of Custody')}
                        </p>
                        <div className="space-y-3">
                           {issue.auditLogs.map((log, idx) => (
                              <div key={idx} className="flex gap-3 text-[11px]">
                                 <div className="w-20 shrink-0 text-muted-foreground font-mono">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                 <div className="flex-1 space-y-0.5">
                                    <div className="font-bold text-foreground capitalize">{t(log.action)} <span className="text-muted-foreground lowercase">{t('by')}</span> {log.performedBy === user?.id ? t('You') : log.performedBy}</div>
                                    <div className="flex items-center gap-1.5 text-muted-foreground">
                                       <span className="bg-muted px-1 rounded">{t(log.previousStatus)}</span>
                                       <ArrowRight className="w-2.5 h-2.5" />
                                       <span className="bg-primary/10 text-primary px-1 rounded">{t(log.newStatus)}</span>
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}

                  {/* Actions based on role and status */}
                  {issue.verificationStatus === 'Rejected' && issue.verificationComment && (
                    <div className="rounded-xl border border-red-300 bg-red-50/70 p-3 space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-700">{t('User Rework Message')}</p>
                      <p className="text-sm text-red-900">{t(issue.verificationComment)}</p>
                      <p className="text-[11px] text-red-700/80">{t('Status sent to admin for action.')}</p>
                    </div>
                  )}

                  {user?.role === 'admin' && issue.needsAdminReview && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-3 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">{t('Admin Action Required')}</p>
                      <Textarea
                        className="min-h-[76px]"
                        value={adminReviewNote}
                        onChange={(e) => setAdminReviewNote(e.target.value)}
                        placeholder={t('Add action note for this rejection (optional)')}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleAdminReview('review')} disabled={submitting}>
                          {submitting ? t('Saving...') : t('Mark Reviewed')}
                        </Button>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAdminReview('mark_completed')} disabled={submitting}>
                          {submitting ? t('Saving...') : t('Mark Completed')}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    {isAuthority && issue.progress === 'In Progress' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-2" onClick={() => setShowResolveForm((v) => !v)} disabled={submitting}>
                        <CheckCircle className="w-4 h-4" /> {showResolveForm ? t('Close Update Form') : t('Submit Completion')}
                      </Button>
                    )}
                    
                    {!isAuthority && issue.progress === 'Resolved' && issue.verificationStatus === 'Pending' && issue.authorId === user?.id && (
                      <div className="flex items-center gap-2 bg-primary/5 p-2 rounded-xl border border-primary/20">
                         <p className="text-xs font-bold mr-2 text-primary">{t('Verify Completion?')}</p>
                         <Button size="sm" variant="outline" className="h-7 text-[10px] border-green-500 text-green-600 hover:bg-green-50" onClick={() => handleVerify('Verified')} disabled={submitting}>{t('YES')}</Button>
                         <Button size="sm" variant="outline" className="h-7 text-[10px] border-red-500 text-red-600 hover:bg-red-50" onClick={() => setShowRejectForm((v) => !v)} disabled={submitting}>{t('NO')}</Button>
                      </div>
                    )}

                    {!isAuthority && issue.progress === 'Resolved' && (issue.verificationStatus === 'Verified' || issue.verificationStatus === 'Pending') && issue.authorId === user?.id && !issue.appeals?.some(a => a.status === 'pending') && (
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 gap-2" onClick={() => setShowAppealForm((v) => !v)} disabled={appealSubmitting} variant="outline">
                        <AlertTriangle className="w-4 h-4" /> {t('Appeal Resolution')}
                      </Button>
                    )}
                  </div>

                  {!isAuthority && issue.progress === 'Resolved' && issue.verificationStatus === 'Pending' && issue.authorId === user?.id && showRejectForm && (
                    <div className="rounded-xl border border-red-300 bg-red-50/60 p-3 space-y-2">
                      <Label className="text-[11px] font-semibold">{t('Tell admin what is wrong')}</Label>
                      <Textarea
                        className="min-h-[88px]"
                        value={rejectMessage}
                        onChange={(e) => setRejectMessage(e.target.value)}
                        placeholder={t('Example: Work quality is poor, leakage still not fixed near gate 2.')}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowRejectForm(false)} disabled={submitting}>{t('Cancel')}</Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => handleVerify('Rejected')}
                          disabled={submitting || !rejectMessage.trim()}
                        >
                          {submitting ? t('Submitting...') : t('Send to Admin')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isAuthority && issue.progress === 'Resolved' && (issue.verificationStatus === 'Verified' || issue.verificationStatus === 'Pending') && issue.authorId === user?.id && showAppealForm && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-3 space-y-2">
                      <Label className="text-[11px] font-semibold">{t('File Resolution Dispute')}</Label>
                      <p className="text-[10px] text-amber-900/80">{t('If you believe this issue was not actually resolved, describe what is still wrong and send an appeal to the admin.')}</p>
                      <Textarea
                        className="min-h-[100px]"
                        value={appealMessage}
                        onChange={(e) => setAppealMessage(e.target.value)}
                        placeholder={t('Example: The pothole on Main Street is still there. Authority only filled it partially, water still collects during rain.')}
                      />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setShowAppealForm(false)} disabled={appealSubmitting}>{t('Cancel')}</Button>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={handleFileAppeal}
                          disabled={appealSubmitting || !appealMessage.trim()}
                        >
                          {appealSubmitting ? t('Sending...') : t('Submit Appeal to Admin')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isAuthority && issue.progress === 'Resolved' && issue.authorId === user?.id && issue.appeals && issue.appeals.length > 0 && (
                    <div className="rounded-xl border border-blue-300 bg-blue-50/60 p-3 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">{t('Appeal History')}</p>
                      <div className="space-y-2">
                        {issue.appeals.map((appeal) => (
                          <div key={appeal.id} className="border-l-2 border-l-blue-400 pl-3 py-1 text-xs">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                appeal.status === 'pending' ? 'bg-blue-200 text-blue-800' :
                                appeal.status === 'reviewed' ?  'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-800'
                              }`}>{t(appeal.status)}</span>
                              {appeal.adminAction && appeal.adminAction !== 'none' && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  appeal.adminAction === 'reassigned' ? 'bg-orange-200 text-orange-800' : 'bg-green-200 text-green-800'
                                }`}>{t(appeal.adminAction === 'reassigned' ? 'REOPENED' : 'RESOLVED')}</span>
                              )}
                            </div>
                            <p className="text-foreground/90 mb-1">"{appeal.message}"</p>
                            {appeal.adminNote && (
                              <p className="text-[10px] font-semibold text-blue-800 bg-blue-100 p-2 rounded italic">{t('Admin Note')}: {appeal.adminNote}</p>
                            )}
                            <p className="text-[9px] text-muted-foreground">{new Date(appeal.timestamp).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAuthority && issue.progress === 'In Progress' && showResolveForm && (
                    <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3 space-y-3">
                      <p className="text-[11px] font-black uppercase tracking-widest text-green-700 dark:text-green-400">
                        {t('Completion Proof Submission')}
                      </p>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold">{t('Upload Completion Image')}</Label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCompletionFileChange}
                          className="w-full text-xs file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                        />
                        {completionFileName && <p className="text-[11px] text-muted-foreground">{completionFileName}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold">{t('Completion Description')}</Label>
                        <Textarea
                          className="min-h-[92px]"
                          value={completionDescription}
                          onChange={(e) => setCompletionDescription(e.target.value)}
                          placeholder={t('Describe what was fixed, where, and when...')}
                        />
                      </div>
                      {resolveError && <p className="text-xs text-red-600 font-medium">{resolveError}</p>}
                      <div className="flex justify-end">
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleResolve} disabled={submitting}>
                          {submitting ? t('Submitting...') : t('Mark as Fixed')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const UserDashboard = ({ issues, stats, user, points = 0 }) => {
  const { t } = useLanguage();
  const userId = normalizeEntityId(user?.id);
  const userIssues = issues.filter((i) => normalizeEntityId(i.authorId) === userId);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard title={t('Civic Points')} value={points} icon={Gauge} colorClass="text-primary bg-primary/10" />
        <StatCard title={t('My Reports')} value={stats.Reported + stats['In Progress'] + stats.Resolved} icon={FileText} colorClass="text-blue-600 bg-blue-50" />
        <StatCard title={t('Action Pending')} value={stats['In Progress']} icon={Clock} colorClass="text-amber-600 bg-amber-50" />
        <StatCard title={t('Issues Resolved')} value={stats.Resolved} icon={CheckCircle} colorClass="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> {t('Your Civic Activity')}
        </h3>
        <div className="space-y-4">
          {userIssues.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10">
              <p className="text-muted-foreground font-medium">{t('You haven\'t started your civic journey yet.')}</p>
              <Button variant="link" className="mt-2 text-primary text-xs font-semibold tracking-wide">{t('Report Neighbor Issue')}</Button>
            </div>
          ) : (
            userIssues.slice().reverse().map(issue => <IssueDetailRow key={issue.id} issue={issue} />)
          )}
        </div>
      </div>
    </div>
  );
};

const AuthorityDashboard = ({ issues, user }) => {
  const { t } = useLanguage();
  const assignedIssues = issues.filter((i) => String(getAssignedId(i)) === String(user.id));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard title={t('Assigned Tasks')} value={assignedIssues.length} icon={ShieldCheck} colorClass="text-indigo-600 bg-indigo-50" />
        <StatCard title={t('Urgent Tasks')} value={assignedIssues.filter(i => i.priorityLabel === 'Critical' || i.priorityLabel === 'High').length} icon={AlertTriangle} colorClass="text-red-600 bg-red-50" />
        <StatCard title={t('Fixed This Month')} value={assignedIssues.filter(i => i.progress === 'Resolved').length} icon={CheckCircle} colorClass="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">{t('Mission Control: Your Tasks')}</h3>
        <div className="space-y-4">
          {assignedIssues.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 text-muted-foreground">{t('No active assignments.')}</div>
          ) : (
            assignedIssues.map(issue => <IssueDetailRow key={issue.id} issue={issue} isAuthority={true} showEvidenceImages={false} />)
          )}
        </div>
      </div>
    </div>
  );
};

const LowerAuthorityDashboard = ({ issues, user }) => {
  const { t } = useLanguage();
  const assignedIssues = issues.filter((i) => String(getAssignedId(i)) === String(user.id));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard title={t('Assigned to Me')} value={assignedIssues.length} icon={ShieldCheck} colorClass="text-indigo-600 bg-indigo-50" />
        <StatCard title={t('Pending Work')} value={assignedIssues.filter(i => i.progress !== 'Resolved').length} icon={Clock} colorClass="text-amber-600 bg-amber-50" />
        <StatCard title={t('Completed by Me')} value={assignedIssues.filter(i => i.progress === 'Resolved').length} icon={CheckCircle} colorClass="text-emerald-600 bg-emerald-50" />
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold tracking-tight">{t('Lower Authority Task Board')}</h3>
        <div className="space-y-4">
          {assignedIssues.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-muted/10 text-muted-foreground">{t('No assigned issues right now.')}</div>
          ) : (
            assignedIssues.map(issue => <IssueDetailRow key={issue.id} issue={issue} isAuthority={true} />)
          )}
        </div>
      </div>
    </div>
  );
};

const AdminDashboard = ({ issues, stats }) => {
  const { t } = useLanguage();
  const { assignIssue, adminReviewIssue, handleAppealAction } = useApp();
  const [authorities, setAuthorities] = useState([]);
  const [reportFilter, setReportFilter] = useState('non-completed');
  const [selectedIssueId, setSelectedIssueId] = useState('');
  const [selectedAuthorityId, setSelectedAuthorityId] = useState('');
  const [assignmentDeadline, setAssignmentDeadline] = useState('');
  const [assignmentNote, setAssignmentNote] = useState('');
  const [assignmentMode, setAssignmentMode] = useState('direct');
  const [assigning, setAssigning] = useState(false);
  const [panelError, setPanelError] = useState('');
  const [panelSuccess, setPanelSuccess] = useState('');
  const [reviewingIssueId, setReviewingIssueId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [adminTab, setAdminTab] = useState('reports');
  const [handlingAppealId, setHandlingAppealId] = useState(null);
  const [appealActionNote, setAppealActionNote] = useState({});
  const [selectedAppealAuthorityId, setSelectedAppealAuthorityId] = useState({});

  useEffect(() => {
    const fetchAuthorities = async () => {
      try {
        const data = await apiJson('/api/issues/authorities');
        setAuthorities(data?.authorities || []);
      } catch (e) {
        console.error(e);
        setPanelError(t('Could not load authority roster.'));
      }
    };
    fetchAuthorities();
  }, []);

  const actionableIssues = useMemo(
    () => issues
      .filter((i) => i.progress !== 'Resolved')
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0)),
    [issues]
  );

  const selectedIssue = useMemo(
    () => actionableIssues.find((issue) => String(issue.id) === String(selectedIssueId)),
    [actionableIssues, selectedIssueId]
  );

  const filteredAuthorities = useMemo(() => {
    if (assignmentMode !== 'lower-delegation') return authorities;
    return authorities.filter((a) => a.authorityLevel === 'L2' || a.authorityLevel === 'L3');
  }, [authorities, assignmentMode]);

  const selectedAuthority = useMemo(
    () => filteredAuthorities.find((a) => String(a.id) === String(selectedAuthorityId)),
    [filteredAuthorities, selectedAuthorityId]
  );

  const handleAssign = async () => {
    if (!selectedIssueId || !selectedAuthorityId) {
      setPanelSuccess('');
      setPanelError(t('Select both issue and authority before assigning.'));
      return;
    }
    if (!assignmentDeadline) {
      setPanelSuccess('');
      setPanelError(t('Deadline is required.'));
      return;
    }
    try {
      setAssigning(true);
      setPanelError('');
      setPanelSuccess('');
      const isoDate = new Date(assignmentDeadline).toISOString();
      await assignIssue(selectedIssueId, selectedAuthorityId, isoDate, {
        note: assignmentNote,
        mode: assignmentMode,
        authorityName: selectedAuthority?.name,
      });
      setAssignmentNote('');
      setPanelSuccess(t('Report assigned successfully.'));
    } catch (e) {
      setPanelSuccess('');
      setPanelError(e?.message || t('Assignment failed. Please try again.'));
    } finally {
      setAssigning(false);
    }
  };

  const visibleAdminIssues = useMemo(() => {
    const byStatus = reportFilter === 'completed'
      ? issues.filter((i) => i.progress === 'Resolved')
      : issues.filter((i) => i.progress !== 'Resolved');
    return byStatus
      .filter((i) => i.priorityScore > 60 || i.prediction || i.progress === 'Resolved' || i.needsAdminReview)
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }, [issues, reportFilter]);

  const issuesWithAppeals = useMemo(() => {
    return issues
      .filter((i) => i.progress === 'Resolved' && i.appeals && i.appeals.some(a => a.status === 'pending'))
      .sort((a, b) => {
        const aLatest = Math.max(...(a.appeals || []).map(ap => new Date(ap.timestamp).getTime()), 0);
        const bLatest = Math.max(...(b.appeals || []).map(ap => new Date(ap.timestamp).getTime()), 0);
        return bLatest - aLatest;
      });
  }, [issues]);

  const assignedPendingIssues = useMemo(() => {
    return issues
      .filter((i) => i.assignedTo && i.progress !== 'Resolved')
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  }, [issues]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('Total Issues')} value={stats.totalIssues} icon={FileText} />
        <StatCard title={t('Unresolved Issues')} value={Math.max((stats.totalIssues || 0) - (stats.resolvedIssues || 0), 0)} icon={AlertTriangle} colorClass="text-red-600 bg-red-50" />
        <StatCard title={t('Assigned Pending')} value={assignedPendingIssues.length} icon={Clock} colorClass="text-blue-600 bg-blue-50" />
        <StatCard title={t('Solved Issues')} value={stats.resolvedIssues || 0} icon={CheckCircle} colorClass="text-emerald-600 bg-emerald-50" />
        <StatCard title={t('Pending Disputes')} value={issuesWithAppeals.length} icon={AlertTriangle} colorClass="text-amber-600 bg-amber-50" />
      </div>

      {/* Tab toggle */}
      <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1 gap-1">
        <button
          type="button"
          onClick={() => setAdminTab('reports')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${adminTab === 'reports' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
        >
          📋 {t('Assignment Control')}
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('assigned')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${adminTab === 'assigned' ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
        >
          ⏳ {t('Assigned Pending')} {assignedPendingIssues.length > 0 && <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{assignedPendingIssues.length}</span>}
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('disputes')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${adminTab === 'disputes' ? 'bg-amber-600 text-white' : 'text-muted-foreground hover:bg-muted'}`}
        >
          ⚖️ {t('Resolution Disputes')} {issuesWithAppeals.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">{issuesWithAppeals.length}</span>}
        </button>
      </div>

      {adminTab === 'reports' ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center justify-between">
            {t('High-Priority Intelligence Feed')}
            <span className="text-[10px] bg-red-600 text-white px-2 py-1 rounded-full animate-pulse">{t('LIVE CONTROL')}</span>
          </h3>
          <div className="inline-flex rounded-xl border border-border/60 bg-muted/20 p-1 gap-1">
            <button
              type="button"
              onClick={() => setReportFilter('non-completed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportFilter === 'non-completed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {t('Non-Completed Reports')}
            </button>
            <button
              type="button"
              onClick={() => setReportFilter('completed')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${reportFilter === 'completed' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {t('Completed Reports')}
            </button>
          </div>
          <div className="space-y-4">
             {visibleAdminIssues.map(issue => (
               <Card key={issue.id} className="shadow-antigravity border-l-4 border-l-red-500">
                  <CardContent className="p-5 flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black tracking-tighter uppercase">{t(issue.priorityLabel)}</span>
                      </div>
                      <h4 className="font-bold text-lg">{t(issue.title)}</h4>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {t(issue.location)}</p>
                      {issue.address && <p className="text-[11px] text-muted-foreground mt-0.5 italic">📍 {issue.address}</p>}
                      {getIssueReportImage(issue) && (
                        <div className="block mt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{t('Report Image')}</p>
                          <EvidenceImage
                            src={getIssueReportImage(issue)}
                            alt={t('Report evidence')}
                            className="h-52 w-full max-w-xl rounded-lg object-contain bg-muted/30 border border-border/60"
                          />
                        </div>
                      )}
                      {getIssueCompletionImage(issue) && (
                        <div className="block mt-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-1">{t('Completion Image')}</p>
                          <EvidenceImage
                            src={getIssueCompletionImage(issue)}
                            alt={t('Completion evidence')}
                            className="h-52 w-full max-w-xl rounded-lg object-contain bg-muted/30 border border-emerald-500/30"
                          />
                        </div>
                      )}

                      {issue.verificationStatus === 'Rejected' && issue.verificationComment && (
                        <div className="mt-3 rounded-xl border border-red-300 bg-red-50/70 p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-1">{t('User Rework Message')}</p>
                          <p className="text-sm text-red-900">{t(issue.verificationComment)}</p>
                          {issue.needsAdminReview && (
                            <div className="mt-3 space-y-2">
                              <Textarea
                                className="min-h-[74px]"
                                value={reviewNotes[issue.id] || ''}
                                onChange={(e) => setReviewNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                                placeholder={t('Add admin action note (optional)')}
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      setReviewingIssueId(issue.id);
                                      await adminReviewIssue(issue.id, reviewNotes[issue.id] || '', 'review');
                                      setReviewNotes((prev) => ({ ...prev, [issue.id]: '' }));
                                    } catch (e) {
                                      setPanelError(e?.message || t('Unable to save admin review.'));
                                    } finally {
                                      setReviewingIssueId(null);
                                    }
                                  }}
                                  disabled={reviewingIssueId === issue.id}
                                >
                                  {reviewingIssueId === issue.id ? t('Saving...') : t('Mark Reviewed')}
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={async () => {
                                    try {
                                      setReviewingIssueId(issue.id);
                                      await adminReviewIssue(issue.id, reviewNotes[issue.id] || '', 'mark_completed');
                                      setReviewNotes((prev) => ({ ...prev, [issue.id]: '' }));
                                      setPanelSuccess(t('Issue marked completed by admin.'));
                                    } catch (e) {
                                      setPanelError(e?.message || t('Unable to mark issue as completed.'));
                                    } finally {
                                      setReviewingIssueId(null);
                                    }
                                  }}
                                  disabled={reviewingIssueId === issue.id}
                                >
                                  {reviewingIssueId === issue.id ? t('Saving...') : t('Mark Completed')}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 justify-center">
                        {issue.progress !== 'Resolved' ? (
                          <Button
                            size="sm"
                            className="h-9 font-semibold bg-primary tracking-wide"
                            onClick={() => setSelectedIssueId(String(issue.id))}
                          >
                            {t('Prepare Assignment')}
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t('Completed')}</span>
                        )}
                    </div>
                  </CardContent>
               </Card>
             ))}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-xl font-bold tracking-tight">{t('Assignment Command Panel')}</h3>

          <Card className="shadow-antigravity overflow-hidden border-primary/30 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.16),transparent_44%),hsl(var(--card))]">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <UserCog className="w-4 h-4" />
                {t('Authority Routing')}
              </CardTitle>
              <CardDescription>
                {t('Assign reports to field teams, including lower-authority delegation when needed.')}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="issue-select">{t('Choose Report')}</Label>
                <select
                  id="issue-select"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={selectedIssueId}
                  onChange={(e) => setSelectedIssueId(e.target.value)}
                >
                  <option value="">{t('Select issue')}</option>
                  {actionableIssues.slice(0, 20).map((issue) => (
                    <option key={issue.id} value={String(issue.id)}>
                      #{issue.id} - {issue.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment-mode">{t('Routing Mode')}</Label>
                <select
                  id="assignment-mode"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={assignmentMode}
                  onChange={(e) => {
                    setAssignmentMode(e.target.value);
                    setSelectedAuthorityId('');
                  }}
                >
                  <option value="direct">{t('Direct Assignment')}</option>
                  <option value="lower-delegation">{t('Lower Authority Delegation')}</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="authority-select">{t('Assign To')}</Label>
                <select
                  id="authority-select"
                  className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
                  value={selectedAuthorityId}
                  onChange={(e) => setSelectedAuthorityId(e.target.value)}
                >
                  <option value="">{t('Select authority')}</option>
                  {filteredAuthorities.map((auth) => (
                    <option key={auth.id} value={auth.id}>
                        {auth.name} ({auth.role}, {auth.authorityLevel}, {auth.department}) - {auth.openIssues} open
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">{t('Deadline')} *</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={assignmentDeadline}
                  onChange={(e) => setAssignmentDeadline(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment-note">{t('Instruction Note')}</Label>
                <Textarea
                  id="assignment-note"
                  className="min-h-[88px]"
                  value={assignmentNote}
                  onChange={(e) => setAssignmentNote(e.target.value)}
                  placeholder={t('Add execution notes, priority context, or escalation details...')}
                />
              </div>

              {selectedIssue && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
                  <p className="font-semibold text-primary mb-1">{t('Selected Issue Snapshot')}</p>
                  <p className="font-medium">#{selectedIssue.id} - {t(selectedIssue.title)}</p>
                  <p className="text-muted-foreground mt-1">{t(selectedIssue.location)} • {t(selectedIssue.priorityLabel || 'Medium')}</p>
                </div>
              )}

              {selectedAuthority && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400 mb-1">{t('Selected Authority')}</p>
                  <p className="font-medium">{selectedAuthority.name} ({selectedAuthority.authorityLevel})</p>
                  <p className="text-muted-foreground mt-1">{selectedAuthority.department} • {selectedAuthority.designation} • {selectedAuthority.openIssues} {t('open reports')}</p>
                </div>
              )}

              {panelError && <p className="text-xs text-red-600 font-medium">{panelError}</p>}
              {panelSuccess && <p className="text-xs text-emerald-700 font-medium">{panelSuccess}</p>}

              <Button className="w-full gap-2 h-10 font-semibold" onClick={handleAssign} disabled={assigning}>
                <Send className="w-4 h-4" />
                {assigning ? t('Assigning...') : t('Assign Report')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      ) : adminTab === 'assigned' ? (
        <div className="space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" /> {t('Assigned Pending')} ({assignedPendingIssues.length})
          </h3>
          {assignedPendingIssues.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground font-medium">{t('All assigned reports have been completed.')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assignedPendingIssues.map((issue) => (
                <Card key={issue.id} className="border-l-4 border-l-blue-500 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-2">
                        <h4 className="font-bold text-lg">#{issue.id} - {t(issue.title)}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {t(issue.location)}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold uppercase">{issue.progress}</span>
                          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                            issue.priorityLabel === 'Critical' ? 'bg-red-100 text-red-800' :
                            issue.priorityLabel === 'High' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{t(issue.priorityLabel)}</span>
                          {issue.assignedToName && <span className="text-[9px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">👤 {issue.assignedToName}</span>}
                        </div>
                        {issue.deadline && (
                          <p className={`text-[10px] font-semibold ${new Date(issue.deadline) < new Date() ? 'text-red-600' : 'text-amber-600'}`}>
                            📅 {t('Deadline')}: {new Date(issue.deadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {issue.description && (
                      <div className="bg-muted/30 rounded-lg p-3 text-xs">
                        <p className="text-foreground">{t(issue.description)}</p>
                      </div>
                    )}
                    {getIssueReportImage(issue) && (
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase mb-2">📸 {t('Report Image')}</p>
                        <EvidenceImage
                          src={getIssueReportImage(issue)}
                          alt={t('Report evidence')}
                          className="h-40 w-full max-w-md rounded-lg object-contain bg-muted/30 border border-border/60"
                        />
                      </div>
                    )}
                    {issue.assignmentNote && (
                      <div className="bg-blue-50/70 dark:bg-blue-950/20 rounded-lg p-3 border border-blue-200/50 dark:border-blue-800/30">
                        <p className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">📝 {t('Assignment Note')}</p>
                        <p className="text-xs text-foreground">{issue.assignmentNote}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" /> {t('Resolution Disputes')} ({issuesWithAppeals.length})
          </h3>
          {issuesWithAppeals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground font-medium">{t('No pending resolution disputes.')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {issuesWithAppeals.map((issue) => (
                <Card key={issue.id} className="border-l-4 border-l-amber-500 shadow-sm">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg mb-1">#{issue.id} - {t(issue.title)}</h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {t(issue.location)}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold uppercase">{t('Originally Resolved')}</span>
                          <span className="text-[9px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-bold">{new Date(issue.completedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {issue.completionDescription && (
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg p-3 border border-emerald-200/50 dark:border-emerald-800/30">
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-1">{t('Original Completion')}</p>
                        <p className="text-xs text-foreground">{issue.completionDescription}</p>
                      </div>
                    )}

                    {getIssueCompletionImage(issue) && (
                      <div>
                        <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2">{t('Completion Image')}</p>
                        <EvidenceImage
                          src={getIssueCompletionImage(issue)}
                          alt={t('Completion evidence')}
                          className="h-40 w-full max-w-md rounded-lg object-contain bg-muted/30 border border-emerald-500/30"
                        />
                      </div>
                    )}

                    {issue.appeals && issue.appeals.filter(a => a.status === 'pending').map((appeal) => (
                      <div key={appeal.id} className="rounded-lg border-2 border-amber-300 bg-amber-50/70 p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">{t('User Appeal #{appealId}', { appealId: appeal.id })}</p>
                            <p className="text-xs font-medium text-foreground">"{appeal.message}"</p>
                            <p className="text-[10px] text-amber-800 mt-2">— {appeal.userName} ({new Date(appeal.timestamp).toLocaleString()})</p>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3 space-y-3 border border-amber-200/50">
                          <div className="space-y-2">
                            <Label className="text-[11px] font-semibold">{t('Admin Action')}</Label>
                            <Textarea
                              className="min-h-[76px]"
                              value={appealActionNote[`${issue.id}-${appeal.id}`] || ''}
                              onChange={(e) => setAppealActionNote((prev) => ({ ...prev, [`${issue.id}-${appeal.id}`]: e.target.value }))}
                              placeholder={t('Explain your action (e.g., "Lower authority\'s work was inadequate, reassigning for proper completion")')}
                            />
                          </div>

                          {['reassigned', 'admin_override'].map((action) => (
                            action === 'reassigned' ? (
                              <div key={action} className="space-y-2">
                                <Label className="text-[11px] font-semibold">{t('Reassign To (if reopening issue)')}</Label>
                                <select
                                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                                  value={selectedAppealAuthorityId[`${issue.id}-${appeal.id}`] || ''}
                                  onChange={(e) => setSelectedAppealAuthorityId((prev) => ({ ...prev, [`${issue.id}-${appeal.id}`]: e.target.value }))}
                                >
                                  <option value="">{t('Select authority to reassign')}</option>
                                  {authorities.map((auth) => (
                                    <option key={auth.id} value={auth.id}>{auth.name} ({auth.authorityLevel})</option>
                                  ))}
                                </select>
                              </div>
                            ) : null
                          ))}

                          <div className="flex gap-2 justify-end pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-orange-500 text-orange-600 hover:bg-orange-50"
                              onClick={async () => {
                                if (!selectedAppealAuthorityId[`${issue.id}-${appeal.id}`]) {
                                  setPanelError(t('Please select an authority to reassign'));
                                  return;
                                }
                                try {
                                  setHandlingAppealId(appeal.id);
                                  await handleAppealAction(issue.id, appeal.id, 'reassigned', appealActionNote[`${issue.id}-${appeal.id}`], selectedAppealAuthorityId[`${issue.id}-${appeal.id}`]);
                                  setAppealActionNote((prev) => ({ ...prev, [`${issue.id}-${appeal.id}`]: '' }));
                                  setSelectedAppealAuthorityId((prev) => ({ ...prev, [`${issue.id}-${appeal.id}`]: '' }));
                                  setPanelSuccess(t('Issue reopened and reassigned.'));
                                } catch (e) {
                                  setPanelError(e?.message || t('Failed to handle appeal'));
                                } finally {
                                  setHandlingAppealId(null);
                                }
                              }}
                              disabled={handlingAppealId === appeal.id}
                            >
                              {handlingAppealId === appeal.id ? t('Processing...') : t('Reopen & Reassign')}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={async () => {
                                try {
                                  setHandlingAppealId(appeal.id);
                                  await handleAppealAction(issue.id, appeal.id, 'admin_override', appealActionNote[`${issue.id}-${appeal.id}`], null);
                                  setAppealActionNote((prev) => ({ ...prev, [`${issue.id}-${appeal.id}`]: '' }));
                                  setPanelSuccess(t('Appeal dismissed - resolution confirmed.'));
                                } catch (e) {
                                  setPanelError(e?.message || t('Failed to handle appeal'));
                                } finally {
                                  setHandlingAppealId(null);
                                }
                              }}
                              disabled={handlingAppealId === appeal.id}
                            >
                              {handlingAppealId === appeal.id ? t('Processing...') : t('Mark as Resolved')}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {(panelError || panelSuccess) && (
            <div className={`rounded-lg p-3 text-sm font-medium ${panelError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {panelError || panelSuccess}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const { issues, isWithinRadius, userStats } = useApp();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [userCoords, setUserCoords] = useState(null);
  const isLowerAuthority = user?.role === 'authority' && ['L2', 'L3'].includes(user?.authorityLevel);
  const normalizedCurrentUserId = normalizeEntityId(user?.id);
  const currentUserStats = normalizedCurrentUserId ? (userStats?.[normalizedCurrentUserId] || {}) : {};
  const currentUserPoints = currentUserStats.points ?? user?.points ?? 0;

  const buildFallbackStats = useMemo(() => {
    if (!user) return null;

    const normalizedUserId = normalizeEntityId(user.id);
    const userScopedIssues = issues.filter((i) => normalizeEntityId(i.authorId) === normalizedUserId);
    const unresolved = issues.filter((i) => i.progress !== 'Resolved');

    return {
      // User dashboard shape
      Reported: userScopedIssues.filter((i) => i.progress === 'Reported').length,
      'In Progress': userScopedIssues.filter((i) => i.progress === 'In Progress').length,
      Resolved: userScopedIssues.filter((i) => i.progress === 'Resolved').length,
      // Admin dashboard shape
      totalIssues: issues.length,
      urgentIssues: unresolved.filter((i) => (i.priorityScore || 0) >= 70 || i.priorityLabel === 'Critical').length,
      resolvedIssues: issues.filter((i) => i.progress === 'Resolved').length,
      pendingVerification: issues.filter((i) => i.progress === 'Resolved' && (i.verificationStatus || 'Pending') === 'Pending').length,
    };
  }, [issues, user]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('Geolocation error:', err)
      );
    }
  }, []);

  const filteredIssues = (user?.role === 'user' && userCoords
    ? issues.filter(i => isWithinRadius({ lat: i.lat, lng: i.lng }, userCoords, 5))
    : issues).sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const url = user?.role === 'admin' ? '/api/dashboard/admin-stats' : '/api/dashboard/user-stats';
        const data = await apiJson(url);
        setStats(data || buildFallbackStats);
      } catch (e) {
        console.error(e);
        setStats(buildFallbackStats);
      }
    };
    if (user) fetchStats();
  }, [user, buildFallbackStats]);

  useEffect(() => {
    if (!stats && buildFallbackStats) {
      setStats(buildFallbackStats);
    }
  }, [stats, buildFallbackStats]);

  if (!stats) return <div className="min-h-screen flex items-center justify-center font-bold text-primary animate-pulse uppercase tracking-widest">{t('Initializing Intelligence...')}</div>;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="rounded-3xl border border-border/60 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_42%),hsl(var(--card))] p-6 md:p-8 mb-10 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              {t('Operations Dashboard')}
            </div>
            <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-2">
              <span className="text-primary">CitySpark</span>
            </h1>
            <p className="text-muted-foreground text-base md:text-lg font-medium max-w-2xl">
              {user?.role === 'admin' ? t('System-wide monitoring, prioritization, and assignment console.') :
               user?.role === 'authority' ? t('Track assigned tasks, progress work, and close issues efficiently.') :
               t('Track your reports, monitor progress, and stay updated with civic activity.')}
            </p>
          </div>

          {user?.role !== 'admin' && !isLowerAuthority && (
            <div className="grid grid-cols-1 gap-3 w-full sm:w-auto">
              <div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" /> {t('Civic Standing')}</div>
                <div className="text-xl font-black text-primary">{currentUserPoints} {t('PTS')}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm p-4 md:p-6">
        {user?.role === 'admin' ? <AdminDashboard issues={issues} stats={stats} /> : 
          user?.role === 'authority' ? (isLowerAuthority ? <LowerAuthorityDashboard issues={filteredIssues} user={user} /> : <AuthorityDashboard issues={filteredIssues} user={user} />) : 
         <UserDashboard issues={filteredIssues} stats={stats} user={user} points={currentUserPoints} />}
      </motion.div>
    </div>
  );
};

export default Dashboard;
