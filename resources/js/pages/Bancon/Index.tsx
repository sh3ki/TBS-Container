import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function Index({ user }: { user: { access: { acs_delete: number } } }) {
  const { toast } = useToast();
  const [bancons, setBancons] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({ container_no: '', client_id: '', reason: '' });

  useEffect(() => {
    loadData();
    loadClients();
  }, []);

  const loadData = async () => {
    try {
      const res = await axios.get('/api/bancon');
      if (res.data.success) setBancons(res.data.bancons);
    } catch (error) {
      console.error(error);
    }
  };

  const loadClients = async () => {
    try {
      const res = await axios.get('/api/inventory/clients');
      if (res.data.success) setClients(res.data.clients);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdd = () => {
    setFormData({ container_no: '', client_id: '', reason: '' });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const res = await axios.post('/api/bancon', formData);
      if (res.data.success) {
        toast({ title: "Success", description: "Container banned successfully" });
        setModalOpen(false);
        loadData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to ban container", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Remove this container from ban list?')) return;
    try {
      const res = await axios.delete(`/api/bancon/${id}`);
      if (res.data.success) {
        toast({ title: "Success", description: "Container removed from ban list" });
        loadData();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
    }
  };

  return (
    <AuthenticatedLayout>
      <Head title="Banned Containers" />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Banned Containers</h1>
          <Button onClick={handleAdd}>Ban Container</Button>
        </div>

        <div className="bg-white rounded shadow">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Container No.</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bancons.map((item) => (
                <TableRow key={item.bc_id}>
                  <TableCell className="font-medium">{item.container_no}</TableCell>
                  <TableCell>{item.client_name}</TableCell>
                  <TableCell>{item.reason}</TableCell>
                  <TableCell>{item.date_added?.substring(0, 10)}</TableCell>
                  <TableCell>
                    {user.access.acs_delete === 1 && (
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(item.bc_id)}>Remove</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {bancons.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-500">No banned containers</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Ban Container</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Container No.</Label>
                <Input value={formData.container_no} onChange={(e) => setFormData({ ...formData, container_no: e.target.value })} />
              </div>
              <div>
                <Label>Client</Label>
                <Select value={formData.client_id} onValueChange={(val) => setFormData({ ...formData, client_id: val })}>
                  <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.c_id} value={c.c_id.toString()}>{c.client_code} - {c.client_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit}>Submit</Button>
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
