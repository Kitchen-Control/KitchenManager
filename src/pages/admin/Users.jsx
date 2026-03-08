import React, { useState, useEffect } from 'react';
import { getAllUsers, createUser, deleteUser, getAllStores } from '../../data/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Loader2, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_ID } from '../../data/constants';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    roleId: '',
    storeId: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [usersData, storesData] = await Promise.all([getAllUsers(), getAllStores()]);
      setUsers(usersData || []);
      setStores(storesData || []);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (userId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này? Hành động này không thể hoàn tác.')) return;
    
    try {
      await deleteUser(userId);
      toast.success('Xóa người dùng thành công');
      fetchData();
    } catch (error) {
      toast.error('Lỗi xóa người dùng: ' + error.message);
    }
  };

  const handleCreate = async () => {
    if (!formData.username || !formData.password || !formData.fullName || !formData.roleId) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
      return;
    }

    // BR-003: Store Staff bắt buộc phải có Store
    if (Number(formData.roleId) === ROLE_ID.STORE_STAFF && !formData.storeId) {
      toast.error('Nhân viên cửa hàng bắt buộc phải chọn Cửa hàng trực thuộc');
      return;
    }

    // BR-033: Mật khẩu tối thiểu 6 ký tự
    if (formData.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsSubmitting(true);
    try {
      await createUser({
        username: formData.username,
        password: formData.password,
        fullName: formData.fullName,
        roleId: Number(formData.roleId),
        storeId: formData.storeId ? Number(formData.storeId) : null
      });
      toast.success('Tạo người dùng thành công');
      setIsOpen(false);
      setFormData({ username: '', password: '', fullName: '', roleId: '', storeId: '' });
      fetchData();
    } catch (error) {
      toast.error('Lỗi tạo người dùng: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Quản lý Người dùng</h1>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> Thêm Người dùng</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Thêm người dùng mới</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <Input placeholder="Tên đăng nhập" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
              <Input type="password" placeholder="Mật khẩu" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              <Input placeholder="Họ và tên" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              
              <Select onValueChange={v => setFormData({...formData, roleId: v})} value={formData.roleId}>
                <SelectTrigger><SelectValue placeholder="Chọn Vai trò" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Admin</SelectItem>
                  <SelectItem value="2">Manager</SelectItem>
                  <SelectItem value="3">Store Staff</SelectItem>
                  <SelectItem value="4">Kitchen Manager</SelectItem>
                  <SelectItem value="5">Supply Coordinator</SelectItem>
                  <SelectItem value="6">Shipper</SelectItem>
                  <SelectItem value="7">Warehouse</SelectItem>
                </SelectContent>
              </Select>

              {Number(formData.roleId) === ROLE_ID.STORE_STAFF && (
                <Select onValueChange={v => setFormData({...formData, storeId: v})} value={formData.storeId}>
                  <SelectTrigger><SelectValue placeholder="Chọn Cửa hàng" /></SelectTrigger>
                  <SelectContent>
                    {stores.map(s => (
                      <SelectItem key={s.store_id} value={String(s.store_id)}>{s.store_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button onClick={handleCreate} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : 'Tạo tài khoản'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Họ tên</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Cửa hàng</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.user_id}>
                  <TableCell>{user.user_id}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.full_name}</TableCell>
                  <TableCell>{user.role_name}</TableCell>
                  <TableCell>{user.store_name || '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(user.user_id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}