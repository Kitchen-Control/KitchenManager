import React, { useState, useEffect } from 'react';
import { getProducts, getTransactionsByProductId } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, History } from 'lucide-react';
import { toast } from 'sonner';

export default function StockCard() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    getProducts()
      .then(data => setProducts(data || []))
      .catch(err => toast.error('Lỗi tải sản phẩm: ' + err.message))
      .finally(() => setIsLoading(false));
  }, []);

  const handleProductChange = async (productId) => {
    if (!productId) {
      setTransactions([]);
      setSelectedProduct('');
      return;
    }
    setSelectedProduct(productId);
    setIsFetching(true);
    try {
      const data = await getTransactionsByProductId(productId);
      setTransactions(data || []);
    } catch (error) {
      toast.error('Lỗi tải lịch sử giao dịch: ' + error.message);
    } finally {
      setIsFetching(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <History className="h-8 w-8" /> Thẻ Kho
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Chọn sản phẩm để xem lịch sử</CardTitle>
          <div className="pt-2">
            <Select onValueChange={handleProductChange} value={selectedProduct}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="-- Chọn sản phẩm --" />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.product_id} value={String(p.product_id)}>
                    {p.product_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead>Ghi chú</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? transactions.map(t => (
                  <TableRow key={t.transactionId}>
                    <TableCell>{new Date(t.createdAt).toLocaleString('vi-VN')}</TableCell>
                    <TableCell>
                      <span className={t.type === 'IMPORT' ? 'text-green-600' : 'text-red-600'}>{t.type}</span>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${t.type === 'IMPORT' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.type === 'IMPORT' ? '+' : '-'}{t.quantity}
                    </TableCell>
                    <TableCell>{t.note}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow><TableCell colSpan={4} className="text-center">Chưa có giao dịch nào.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}