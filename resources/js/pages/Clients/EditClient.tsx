import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface Client {
  c_id: number;
  client_name: string;
  client_code: string;
  client_address: string;
  client_email: string;
  contact_person: string;
  phone_number: string;
  fax_number: string;
  date_added: string;
}

interface StorageRate {
  s_id: number;
  client_id: number;
  size: number;
  rate: number;
  size_name: string;
  date_added: string;
}

interface HandlingRate {
  h_id: number;
  client_id: number;
  size: number;
  rate: number;
  size_name: string;
  date_added: string;
}

interface RegularHours {
  reg_id: number;
  client_id: number;
  start_time: string;
  end_time: string;
  w_start_time: string;
  w_end_time: string;
  date_added: string;
}

interface ContainerSize {
  cs_id: number;
  size_name: string;
}

export default function EditClient({ clientId }: { clientId: number }) {
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Storage Rates
  const [storageRates, setStorageRates] = useState<StorageRate[]>([]);
  const [newStorageSize, setNewStorageSize] = useState<string>('');
  const [newStorageRate, setNewStorageRate] = useState<string>('');
  
  // Handling Rates
  const [handlingRates, setHandlingRates] = useState<HandlingRate[]>([]);
  const [newHandlingSize, setNewHandlingSize] = useState<string>('');
  const [newHandlingRate, setNewHandlingRate] = useState<string>('');
  
  // Regular Hours
  const [incomingHours, setIncomingHours] = useState({
    start_time: '',
    end_time: ''
  });
  
  const [withdrawalHours, setWithdrawalHours] = useState({
    start_time: '',
    end_time: ''
  });
  
  // Container Sizes
  const [containerSizes, setContainerSizes] = useState<ContainerSize[]>([]);
  
  // Client Form
  const [clientForm, setClientForm] = useState({
    client_name: '',
    client_code: '',
    client_address: '',
    client_email: '',
    contact_person: '',
    phone_number: '',
    fax_number: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        loadClient(),
        loadContainerSizes(),
        loadStorageRates(),
        loadHandlingRates(),
        loadRegularHours()
      ]);
    };
    fetchData();
  }, [clientId]);

  const loadClient = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/clients/${clientId}`);
      if (response.data.success) {
        setClient(response.data.client);
        setClientForm({
          client_name: response.data.client.client_name,
          client_code: response.data.client.client_code,
          client_address: response.data.client.client_address || '',
          client_email: response.data.client.client_email || '',
          contact_person: response.data.client.contact_person,
          phone_number: response.data.client.phone_number || '',
          fax_number: response.data.client.fax_number || '',
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load client",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadContainerSizes = async () => {
    try {
      const response = await axios.get('/api/clients/container-sizes');
      if (response.data.success) {
        setContainerSizes(response.data.sizes);
      }
    } catch (error) {
      console.error('Error loading container sizes:', error);
    }
  };

  const loadStorageRates = async () => {
    try {
      const response = await axios.get(`/api/clients/${clientId}/storage-rates`);
      if (response.data.success) {
        setStorageRates(response.data.rates);
      }
    } catch (error) {
      console.error('Error loading storage rates:', error);
    }
  };

  const loadHandlingRates = async () => {
    try {
      const response = await axios.get(`/api/clients/${clientId}/handling-rates`);
      if (response.data.success) {
        setHandlingRates(response.data.rates);
      }
    } catch (error) {
      console.error('Error loading handling rates:', error);
    }
  };

  const loadRegularHours = async () => {
    try {
      // Load incoming hours
      const incomingResponse = await axios.get(`/api/clients/${clientId}/regular-hours/incoming`);
      if (incomingResponse.data.success && incomingResponse.data.hours) {
        setIncomingHours({
          start_time: incomingResponse.data.hours.start_time || '',
          end_time: incomingResponse.data.hours.end_time || '',
        });
      }
      
      // Load withdrawal hours
      const withdrawalResponse = await axios.get(`/api/clients/${clientId}/regular-hours/withdrawal`);
      if (withdrawalResponse.data.success && withdrawalResponse.data.hours) {
        setWithdrawalHours({
          start_time: withdrawalResponse.data.hours.w_start_time || '',
          end_time: withdrawalResponse.data.hours.w_end_time || '',
        });
      }
    } catch (error) {
      console.error('Error loading regular hours:', error);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.put(`/api/clients/${clientId}`, clientForm);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Client updated successfully",
        });
        loadClient();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to update client";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleAddStorageRate = async () => {
    if (!newStorageSize || !newStorageRate) {
      toast({
        title: "Error",
        description: "Please select a size and enter a rate",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(`/api/clients/${clientId}/storage-rates`, {
        size: parseInt(newStorageSize),
        rate: parseFloat(newStorageRate),
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Storage rate added successfully",
        });
        setNewStorageSize('');
        setNewStorageRate('');
        loadStorageRates();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to add storage rate";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteStorageRate = async (rateId: number) => {
    try {
      const response = await axios.delete(`/api/clients/${clientId}/storage-rates/${rateId}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Storage rate deleted successfully",
        });
        loadStorageRates();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to delete storage rate";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleAddHandlingRate = async () => {
    if (!newHandlingSize || !newHandlingRate) {
      toast({
        title: "Error",
        description: "Please select a size and enter a rate",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await axios.post(`/api/clients/${clientId}/handling-rates`, {
        size: parseInt(newHandlingSize),
        rate: parseFloat(newHandlingRate),
      });
      
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Handling rate added successfully",
        });
        setNewHandlingSize('');
        setNewHandlingRate('');
        loadHandlingRates();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to add handling rate";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteHandlingRate = async (rateId: number) => {
    try {
      const response = await axios.delete(`/api/clients/${clientId}/handling-rates/${rateId}`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Handling rate deleted successfully",
        });
        loadHandlingRates();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to delete handling rate";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateIncomingHours = async () => {
    try {
      const response = await axios.post(`/api/clients/${clientId}/regular-hours/incoming`, {
        start_time: incomingHours.start_time,
        end_time: incomingHours.end_time,
      });
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Incoming hours updated successfully",
        });
        loadRegularHours();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to update incoming hours";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleUpdateWithdrawalHours = async () => {
    try {
      const response = await axios.post(`/api/clients/${clientId}/regular-hours/withdrawal`, {
        start_time: withdrawalHours.start_time,
        end_time: withdrawalHours.end_time,
      });
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Withdrawal hours updated successfully",
        });
        loadRegularHours();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to update withdrawal hours";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteIncomingHours = async () => {
    try {
      const response = await axios.delete(`/api/clients/${clientId}/regular-hours/incoming`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Incoming hours deleted successfully",
        });
        setIncomingHours({ start_time: '', end_time: '' });
        loadRegularHours();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to delete incoming hours";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDeleteWithdrawalHours = async () => {
    try {
      const response = await axios.delete(`/api/clients/${clientId}/regular-hours/withdrawal`);
      if (response.data.success) {
        toast({
          title: "Success",
          description: "Withdrawal hours deleted successfully",
        });
        setWithdrawalHours({ start_time: '', end_time: '' });
        loadRegularHours();
      }
    } catch (error) {
      const errorMessage = (error as {response?: {data?: {message?: string}}}).response?.data?.message || "Failed to delete withdrawal hours";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AuthenticatedLayout>
        <Head title="Edit Client" />
        <div className="p-6">
          <div className="text-center text-gray-500">Loading...</div>
        </div>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Head title={`Edit Client - ${client?.client_name}`} />

      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.visit('/clients')}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Clients
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">Edit Client: {client?.client_name}</h1>
        </div>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="storage">Storage Rates</TabsTrigger>
            <TabsTrigger value="handling">Handling Rates</TabsTrigger>
            <TabsTrigger value="hours">Regular Hours</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic">
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
                <CardDescription>Update client basic information</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateClient}>
                  <div className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="client_name">Client Name *</Label>
                        <Input
                          id="client_name"
                          value={clientForm.client_name}
                          onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="client_code">Client Code *</Label>
                        <Input
                          id="client_code"
                          value={clientForm.client_code}
                          onChange={(e) => setClientForm({ ...clientForm, client_code: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="client_address">Address</Label>
                      <Input
                        id="client_address"
                        value={clientForm.client_address}
                        onChange={(e) => setClientForm({ ...clientForm, client_address: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="client_email">Email</Label>
                      <Input
                        id="client_email"
                        type="email"
                        value={clientForm.client_email}
                        onChange={(e) => setClientForm({ ...clientForm, client_email: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="contact_person">Contact Person *</Label>
                      <Input
                        id="contact_person"
                        value={clientForm.contact_person}
                        onChange={(e) => setClientForm({ ...clientForm, contact_person: e.target.value })}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="phone_number">Phone Number</Label>
                        <Input
                          id="phone_number"
                          value={clientForm.phone_number}
                          onChange={(e) => setClientForm({ ...clientForm, phone_number: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="fax_number">Fax Number</Label>
                        <Input
                          id="fax_number"
                          value={clientForm.fax_number}
                          onChange={(e) => setClientForm({ ...clientForm, fax_number: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button type="submit">
                        <Save size={16} className="mr-2" />
                        Save Changes
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Rates Tab */}
          <TabsContent value="storage">
            <Card>
              <CardHeader>
                <CardTitle>Storage Rates</CardTitle>
                <CardDescription>Manage storage rates by container size</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add New Rate */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Container Size</Label>
                      <Select value={newStorageSize} onValueChange={setNewStorageSize}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {containerSizes.map((size) => (
                            <SelectItem key={size.cs_id} value={size.cs_id.toString()}>
                              {size.size_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label>Rate (₱)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newStorageRate}
                        onChange={(e) => setNewStorageRate(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddStorageRate}>
                      <Plus size={16} className="mr-2" />
                      Add Rate
                    </Button>
                  </div>

                  {/* Rates Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Container Size</TableHead>
                        <TableHead>Rate (₱)</TableHead>
                        <TableHead>Date Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storageRates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500">
                            No storage rates added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        storageRates.map((rate) => (
                          <TableRow key={rate.s_id}>
                            <TableCell className="font-medium">{rate.size_name}</TableCell>
                            <TableCell>₱{rate.rate.toFixed(2)}</TableCell>
                            <TableCell>{new Date(rate.date_added).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteStorageRate(rate.s_id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Handling Rates Tab */}
          <TabsContent value="handling">
            <Card>
              <CardHeader>
                <CardTitle>Handling Rates</CardTitle>
                <CardDescription>Manage handling rates by container size</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add New Rate */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label>Container Size</Label>
                      <Select value={newHandlingSize} onValueChange={setNewHandlingSize}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {containerSizes.map((size) => (
                            <SelectItem key={size.cs_id} value={size.cs_id.toString()}>
                              {size.size_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label>Rate (₱)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={newHandlingRate}
                        onChange={(e) => setNewHandlingRate(e.target.value)}
                      />
                    </div>
                    <Button onClick={handleAddHandlingRate}>
                      <Plus size={16} className="mr-2" />
                      Add Rate
                    </Button>
                  </div>

                  {/* Rates Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Container Size</TableHead>
                        <TableHead>Rate (₱)</TableHead>
                        <TableHead>Date Added</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {handlingRates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-gray-500">
                            No handling rates added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        handlingRates.map((rate) => (
                          <TableRow key={rate.h_id}>
                            <TableCell className="font-medium">{rate.size_name}</TableCell>
                            <TableCell>₱{rate.rate.toFixed(2)}</TableCell>
                            <TableCell>{new Date(rate.date_added).toLocaleDateString()}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteHandlingRate(rate.h_id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Regular Hours Tab - Legacy Layout */}
          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle>Regular Hours</CardTitle>
                <CardDescription>Set client's regular hours for incoming and withdrawal operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Incoming Hours Section */}
                  <div className="border-b pb-6">
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Regular Hours (Incoming)</h3>
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div>
                        <Label htmlFor="incoming_start">Time Start</Label>
                        <Input
                          id="incoming_start"
                          type="time"
                          value={incomingHours.start_time}
                          onChange={(e) => setIncomingHours({ ...incomingHours, start_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="incoming_end">Time End</Label>
                        <Input
                          id="incoming_end"
                          type="time"
                          value={incomingHours.end_time}
                          onChange={(e) => setIncomingHours({ ...incomingHours, end_time: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleUpdateIncomingHours}
                          disabled={!incomingHours.start_time || !incomingHours.end_time}
                        >
                          <Save size={16} className="mr-2" />
                          Add Incoming Hours
                        </Button>
                        {incomingHours.start_time && incomingHours.end_time && (
                          <Button 
                            variant="destructive"
                            onClick={handleDeleteIncomingHours}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                    {incomingHours.start_time && incomingHours.end_time && (
                      <div className="mt-4 p-3 border rounded bg-gray-50">
                        <span className="font-medium">Current: </span>
                        <span className="text-blue-600">
                          {incomingHours.start_time} - {incomingHours.end_time}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Withdrawal Hours Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-blue-600 mb-4">Regular Hours (Withdrawal)</h3>
                    <div className="grid grid-cols-3 gap-4 items-end">
                      <div>
                        <Label htmlFor="withdrawal_start">Time Start</Label>
                        <Input
                          id="withdrawal_start"
                          type="time"
                          value={withdrawalHours.start_time}
                          onChange={(e) => setWithdrawalHours({ ...withdrawalHours, start_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="withdrawal_end">Time End</Label>
                        <Input
                          id="withdrawal_end"
                          type="time"
                          value={withdrawalHours.end_time}
                          onChange={(e) => setWithdrawalHours({ ...withdrawalHours, end_time: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={handleUpdateWithdrawalHours}
                          disabled={!withdrawalHours.start_time || !withdrawalHours.end_time}
                        >
                          <Save size={16} className="mr-2" />
                          Add Withdrawal Hours
                        </Button>
                        {withdrawalHours.start_time && withdrawalHours.end_time && (
                          <Button 
                            variant="destructive"
                            onClick={handleDeleteWithdrawalHours}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                    {withdrawalHours.start_time && withdrawalHours.end_time && (
                      <div className="mt-4 p-3 border rounded bg-gray-50">
                        <span className="font-medium">Current: </span>
                        <span className="text-blue-600">
                          {withdrawalHours.start_time} - {withdrawalHours.end_time}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AuthenticatedLayout>
  );
}
