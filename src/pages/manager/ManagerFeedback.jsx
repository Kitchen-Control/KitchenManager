import React, { useState, useEffect, useMemo } from 'react';
import { getAllFeedbacks, getAllStores } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Loader2,
  Star,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Store,
  Search,
  X,
  SmilePlus,
  Frown,
  Meh,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

/* ─────────────────────────── helpers ─────────────────────────── */

function Stars({ rating, size = 'sm' }) {
  const sz = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(sz, s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200')}
        />
      ))}
    </div>
  );
}

const RATING_META = {
  5: { label: 'Rất hài lòng',       color: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  4: { label: 'Hài lòng',           color: 'bg-green-400',   text: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-200' },
  3: { label: 'Bình thường',         color: 'bg-amber-400',   text: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  2: { label: 'Không hài lòng',     color: 'bg-orange-400',  text: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  1: { label: 'Rất không hài lòng', color: 'bg-red-500',     text: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' },
};

function RatingBadge({ rating }) {
  const m = RATING_META[rating];
  if (!m) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', m.bg, m.text, m.border)}>
      <Star className="h-3 w-3 fill-current" />
      {m.label}
    </span>
  );
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatCard({ icon: Icon, iconClass, label, value, sub }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('p-3 rounded-xl shrink-0', iconClass)}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── component ─────────────────────────── */

export default function ManagerFeedback() {
  const [feedbacks, setFeedbacks]   = useState([]);
  const [stores, setStores]         = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [filterStore, setFilterStore] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [search, setSearch]         = useState('');

  /* ── fetch ── */
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fbData, storeData] = await Promise.all([
        getAllFeedbacks().catch(() => []),
        getAllStores().catch(() => []),
      ]);
      setFeedbacks(Array.isArray(fbData) ? fbData : []);
      setStores(Array.isArray(storeData) ? storeData : []);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  /* ── stats ── */
  const avgRating = useMemo(() => {
    if (!feedbacks.length) return null;
    return (feedbacks.reduce((s, f) => s + (f.rating || 0), 0) / feedbacks.length).toFixed(1);
  }, [feedbacks]);

  const positivePct = useMemo(() => {
    if (!feedbacks.length) return 0;
    return Math.round((feedbacks.filter((f) => f.rating >= 4).length / feedbacks.length) * 100);
  }, [feedbacks]);

  const ratingDist = useMemo(
    () => [5, 4, 3, 2, 1].map((r) => ({ star: r, count: feedbacks.filter((f) => f.rating === r).length })),
    [feedbacks],
  );

  /* ── filtered ── */
  const filtered = useMemo(() => {
    let list = feedbacks.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (filterStore !== 'all') list = list.filter((f) => String(f.store_id) === filterStore);
    if (filterRating !== 'all') list = list.filter((f) => String(f.rating) === filterRating);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (f) =>
          (f.store_name || '').toLowerCase().includes(q) ||
          (f.comment || '').toLowerCase().includes(q) ||
          String(f.order_id).includes(q),
      );
    }
    return list;
  }, [feedbacks, filterStore, filterRating, search]);

  const hasFilter = filterStore !== 'all' || filterRating !== 'all' || search.trim();

  /* ── loading ── */
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">Đang tải phản hồi...</p>
      </div>
    );
  }

  /* ── empty state ── */
  if (!feedbacks.length) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="p-5 rounded-full bg-muted">
          <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Chưa có phản hồi nào</h2>
          <p className="text-muted-foreground text-sm mt-1">Khi cửa hàng gửi đánh giá, chúng sẽ hiển thị ở đây.</p>
        </div>
        <Button variant="outline" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" />Làm mới</Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-8 w-8 text-primary" />
            Phản hồi Cửa hàng
          </h1>
          <p className="text-muted-foreground mt-1">
            Tổng hợp đánh giá chất lượng từ tất cả cửa hàng
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />Làm mới
        </Button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Star}
          iconClass="bg-amber-100 text-amber-600"
          label="Điểm trung bình"
          value={<span>{avgRating} <span className="text-base font-normal text-muted-foreground">/ 5</span></span>}
          sub={<Stars rating={Math.round(Number(avgRating))} />}
        />
        <StatCard
          icon={MessageSquare}
          iconClass="bg-blue-100 text-blue-600"
          label="Tổng phản hồi"
          value={feedbacks.length}
          sub="từ tất cả cửa hàng"
        />
        <StatCard
          icon={SmilePlus}
          iconClass="bg-emerald-100 text-emerald-600"
          label="Hài lòng (4–5 ★)"
          value={`${positivePct}%`}
          sub={`${feedbacks.filter((f) => f.rating >= 4).length} phản hồi`}
        />
        <StatCard
          icon={Frown}
          iconClass="bg-red-100 text-red-500"
          label="Không hài lòng (1–2 ★)"
          value={feedbacks.filter((f) => f.rating <= 2).length}
          sub="cần cải thiện"
        />
      </div>

      {/* ── Rating distribution ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Phân bổ đánh giá</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {ratingDist.map(({ star, count }) => {
            const pct = feedbacks.length ? Math.round((count / feedbacks.length) * 100) : 0;
            const m = RATING_META[star];
            return (
              <div key={star} className="flex items-center gap-3">
                <button
                  onClick={() => setFilterRating(filterRating === String(star) ? 'all' : String(star))}
                  className="flex items-center gap-1 w-16 shrink-0 hover:opacity-70 transition-opacity"
                >
                  <span className="text-sm font-semibold">{star}</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </button>
                <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', m.color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-20 text-right">
                  {count} <span className="text-xs">({pct}%)</span>
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Tìm theo cửa hàng, nhận xét, đơn hàng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Store filter */}
        <Select value={filterStore} onValueChange={setFilterStore}>
          <SelectTrigger className="w-48">
            <Store className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Tất cả cửa hàng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cửa hàng</SelectItem>
            {stores.map((s) => (
              <SelectItem key={s.store_id} value={String(s.store_id)}>
                {s.store_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Rating filter */}
        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-36">
            <Star className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Tất cả sao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả sao</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={String(r)}>{r} sao</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterStore('all'); setFilterRating('all'); setSearch(''); }}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />Xóa bộ lọc
          </Button>
        )}

        <span className="text-sm text-muted-foreground ml-auto whitespace-nowrap">
          {filtered.length} / {feedbacks.length} phản hồi
        </span>
      </div>

      {/* ── Feedback list ── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Meh className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Không có kết quả phù hợp</p>
            <p className="text-sm text-muted-foreground mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((fb) => {
            const m = RATING_META[fb.rating] || RATING_META[3];
            return (
              <Card
                key={fb.feedback_id}
                className={cn(
                  'transition-all hover:shadow-md border-l-4',
                  fb.rating >= 4 ? 'border-l-emerald-400' :
                  fb.rating === 3 ? 'border-l-amber-400' : 'border-l-red-400',
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm">
                          {fb.store_name || `Cửa hàng #${fb.store_id}`}
                        </span>
                        <Badge variant="outline" className="text-xs font-normal">
                          Đơn #{fb.order_id}
                        </Badge>
                        <RatingBadge rating={fb.rating} />
                      </div>

                      {/* Stars */}
                      <Stars rating={fb.rating} />

                      {/* Comment */}
                      {fb.comment ? (
                        <p className="text-sm text-foreground/80 italic leading-relaxed">
                          &ldquo;{fb.comment}&rdquo;
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50">
                          — Không có nhận xét —
                        </p>
                      )}
                    </div>

                    {/* Date */}
                    <div className="text-right shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(fb.created_at)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
