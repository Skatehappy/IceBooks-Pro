import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { DollarSign, Users, Calendar, Settings as SettingsIcon, FileText, TrendingUp, Car } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Default expense categories
const DEFAULT_EXPENSE_CATEGORIES = [
  'Ice Time',
  'Equipment',
  'Insurance',
  'Professional Development',
  'Marketing',
  'Office Supplies',
  'Software/Technology',
  'Travel',
  'Meals & Entertainment',
  'Other'
];

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings(data);
      } else {
        // Create default settings
        const defaultSettings = {
          expense_categories: DEFAULT_EXPENSE_CATEGORIES,
          mileage_rate: 0.67, // 2024 IRS standard rate
          vehicle_expense_method: 'standard', // 'standard' or 'actual'
          currency_symbol: '$',
          date_format: 'MM/DD/YYYY'
        };

        const { data: newSettings, error: insertError } = await supabase
          .from('app_settings')
          .insert([defaultSettings])
          .select()
          .single();

        if (insertError) throw insertError;
        setSettings(newSettings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'sessions', label: 'Sessions', icon: Calendar },
    { id: 'expenses', label: 'Expenses', icon: DollarSign },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: SettingsIcon }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading IceBooks Pro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">IceBooks Pro</h1>
            <div className="text-sm text-gray-500">Ice Skating Coaching Management</div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <Dashboard settings={settings} />}
        {activeTab === 'students' && <Students settings={settings} />}
        {activeTab === 'sessions' && <Sessions settings={settings} />}
        {activeTab === 'expenses' && <Expenses settings={settings} />}
        {activeTab === 'reports' && <Reports settings={settings} />}
        {activeTab === 'settings' && <Settings settings={settings} onSettingsUpdate={loadSettings} />}
      </main>
    </div>
  );
};

// Dashboard Component
const Dashboard = ({ settings }) => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    upcomingSessions: 0,
    monthlyRevenue: 0,
    monthlyExpenses: 0
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      // Get total students
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      // Get upcoming sessions (next 7 days)
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { count: sessionCount } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .gte('date', today)
        .lte('date', nextWeek);

      // Get current month revenue
      const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: sessions } = await supabase
        .from('sessions')
        .select('amount')
        .gte('date', firstDay)
        .lte('date', lastDay)
        .eq('status', 'completed');

      const revenue = sessions?.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) || 0;

      // Get current month expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', firstDay)
        .lte('date', lastDay);

      const expenseTotal = expenses?.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0) || 0;

      setStats({
        totalStudents: studentCount || 0,
        upcomingSessions: sessionCount || 0,
        monthlyRevenue: revenue,
        monthlyExpenses: expenseTotal
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Students"
          value={stats.totalStudents}
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Upcoming Sessions"
          value={stats.upcomingSessions}
          icon={Calendar}
          color="green"
        />
        <StatCard
          title="Monthly Revenue"
          value={`${settings?.currency_symbol || '$'}${stats.monthlyRevenue.toFixed(2)}`}
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Monthly Expenses"
          value={`${settings?.currency_symbol || '$'}${stats.monthlyExpenses.toFixed(2)}`}
          icon={DollarSign}
          color="red"
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Monthly Net Profit:</span>
            <span className={`font-semibold ${stats.monthlyRevenue - stats.monthlyExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {settings?.currency_symbol || '$'}{(stats.monthlyRevenue - stats.monthlyExpenses).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Profit Margin:</span>
            <span className="font-semibold text-gray-900">
              {stats.monthlyRevenue > 0 ? ((stats.monthlyRevenue - stats.monthlyExpenses) / stats.monthlyRevenue * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600'
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

// Students Component (Placeholder)
const Students = ({ settings }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Students</h2>
      <p className="text-gray-600">Student management interface will be displayed here.</p>
    </div>
  );
};

// Sessions Component (Placeholder)
const Sessions = ({ settings }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Sessions</h2>
      <p className="text-gray-600">Session management interface will be displayed here.</p>
    </div>
  );
};

// Expenses Component
const Expenses = ({ settings }) => {
  const [expenses, setExpenses] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    is_mileage: false,
    miles: '',
    vehicle_notes: ''
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error loading expenses:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let finalAmount = parseFloat(formData.amount);
      
      // If mileage expense and using standard mileage rate
      if (formData.is_mileage && settings?.vehicle_expense_method === 'standard' && formData.miles) {
        finalAmount = parseFloat(formData.miles) * parseFloat(settings.mileage_rate);
      }

      const expenseData = {
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: finalAmount,
        is_mileage: formData.is_mileage,
        miles: formData.is_mileage ? parseFloat(formData.miles) || null : null,
        vehicle_notes: formData.is_mileage ? formData.vehicle_notes : null
      };

      const { error } = await supabase
        .from('expenses')
        .insert([expenseData]);

      if (error) throw error;

      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
        amount: '',
        is_mileage: false,
        miles: '',
        vehicle_notes: ''
      });
      setShowAddForm(false);
      loadExpenses();
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Error adding expense: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Error deleting expense: ' + error.message);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">New Expense</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  required
                >
                  <option value="">Select category...</option>
                  {settings?.expense_categories?.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Enter description..."
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_mileage"
                checked={formData.is_mileage}
                onChange={(e) => setFormData({ ...formData, is_mileage: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="is_mileage" className="text-sm font-medium text-gray-700">
                Vehicle/Mileage Expense <Car className="inline w-4 h-4" />
              </label>
            </div>

            {formData.is_mileage && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Miles Driven
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.miles}
                      onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="0.0"
                      required={formData.is_mileage}
                    />
                  </div>

                  {settings?.vehicle_expense_method === 'standard' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Calculated Amount
                      </label>
                      <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100">
                        {formData.miles ? `${settings.currency_symbol}${(parseFloat(formData.miles) * parseFloat(settings.mileage_rate)).toFixed(2)}` : '$0.00'}
                        <span className="text-sm text-gray-500 ml-2">
                          @ {settings.currency_symbol}{settings.mileage_rate}/mi
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Actual Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_notes}
                    onChange={(e) => setFormData({ ...formData, vehicle_notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Student pickup/dropoff, Equipment purchase trip"
                  />
                </div>
              </div>
            )}

            {!formData.is_mileage && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="0.00"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Add Expense
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Miles</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(expense.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {expense.category}
                  {expense.is_mileage && <Car className="inline w-4 h-4 ml-1 text-blue-600" />}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {expense.description}
                  {expense.vehicle_notes && (
                    <div className="text-xs text-gray-500 mt-1">{expense.vehicle_notes}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {expense.miles ? `${expense.miles} mi` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {settings?.currency_symbol || '$'}{parseFloat(expense.amount).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                  No expenses recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Reports Component
const Reports = ({ settings }) => {
  const [activeReport, setActiveReport] = useState('pl');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Reports</h2>

      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveReport('pl')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeReport === 'pl'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Profit & Loss
        </button>
        <button
          onClick={() => setActiveReport('mileage')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeReport === 'mileage'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Mileage Log
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Date Range</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {activeReport === 'pl' && <ProfitLossReport dateRange={dateRange} settings={settings} />}
      {activeReport === 'mileage' && <MileageLogReport dateRange={dateRange} settings={settings} />}
    </div>
  );
};

// Profit & Loss Report
const ProfitLossReport = ({ dateRange, settings }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReportData();
  }, [dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      // Get income from sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('amount')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .eq('status', 'completed');

      if (sessionsError) throw sessionsError;

      const totalIncome = sessions?.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0) || 0;

      // Get expenses by category
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', dateRange.start)
        .lte('date', dateRange.end);

      if (expensesError) throw expensesError;

      // Group expenses by category
      const expensesByCategory = {};
      let vehicleExpenses = 0;
      let totalMiles = 0;

      expenses?.forEach(expense => {
        const amount = parseFloat(expense.amount) || 0;
        
        if (expense.is_mileage) {
          vehicleExpenses += amount;
          totalMiles += parseFloat(expense.miles) || 0;
        } else {
          if (!expensesByCategory[expense.category]) {
            expensesByCategory[expense.category] = 0;
          }
          expensesByCategory[expense.category] += amount;
        }
      });

      const totalExpenses = Object.values(expensesByCategory).reduce((sum, val) => sum + val, 0) + vehicleExpenses;
      const netProfit = totalIncome - totalExpenses;

      setReportData({
        income: totalIncome,
        expensesByCategory,
        vehicleExpenses,
        totalMiles,
        totalExpenses,
        netProfit
      });
    } catch (error) {
      console.error('Error loading P&L report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">No data available for the selected date range.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-900">Profit & Loss Statement</h3>
        <div className="text-sm text-gray-500">
          {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
        </div>
      </div>

      {/* Income Section */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Income</h4>
        <div className="flex justify-between items-center py-2">
          <span className="text-gray-700">Coaching Revenue</span>
          <span className="font-semibold text-gray-900">
            {settings?.currency_symbol || '$'}{reportData.income.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center py-2 border-t border-gray-200 font-bold">
          <span className="text-gray-900">Total Income</span>
          <span className="text-gray-900">
            {settings?.currency_symbol || '$'}{reportData.income.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">Expenses</h4>
        {Object.entries(reportData.expensesByCategory).map(([category, amount]) => (
          <div key={category} className="flex justify-between items-center py-2">
            <span className="text-gray-700">{category}</span>
            <span className="text-gray-900">
              {settings?.currency_symbol || '$'}{amount.toFixed(2)}
            </span>
          </div>
        ))}
        {reportData.vehicleExpenses > 0 && (
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-700 flex items-center">
              Vehicle Expenses <Car className="w-4 h-4 ml-1" />
              <span className="text-sm text-gray-500 ml-2">
                ({reportData.totalMiles.toFixed(1)} miles)
              </span>
            </span>
            <span className="text-gray-900">
              {settings?.currency_symbol || '$'}{reportData.vehicleExpenses.toFixed(2)}
            </span>
          </div>
        )}
        <div className="flex justify-between items-center py-2 border-t border-gray-200 font-bold">
          <span className="text-gray-900">Total Expenses</span>
          <span className="text-gray-900">
            {settings?.currency_symbol || '$'}{reportData.totalExpenses.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Net Profit Section */}
      <div className="border-t-2 border-gray-300 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold text-gray-900">Net Profit</span>
          <span className={`text-xl font-bold ${reportData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {settings?.currency_symbol || '$'}{reportData.netProfit.toFixed(2)}
          </span>
        </div>
        {reportData.income > 0 && (
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-600">Profit Margin</span>
            <span className="text-sm font-semibold text-gray-900">
              {((reportData.netProfit / reportData.income) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Mileage Log Report
const MileageLogReport = ({ dateRange, settings }) => {
  const [mileageData, setMileageData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMileageData();
  }, [dateRange]);

  const loadMileageData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('is_mileage', true)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: true });

      if (error) throw error;
      setMileageData(data || []);
    } catch (error) {
      console.error('Error loading mileage data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading mileage log...</p>
        </div>
      </div>
    );
  }

  const totalMiles = mileageData.reduce((sum, entry) => sum + (parseFloat(entry.miles) || 0), 0);
  const totalAmount = mileageData.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-900">Mileage Log</h3>
          <div className="text-sm text-gray-500">
            {new Date(dateRange.start).toLocaleDateString()} - {new Date(dateRange.end).toLocaleDateString()}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium">Total Miles</div>
            <div className="text-2xl font-bold text-blue-900">{totalMiles.toFixed(1)}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium">Total Deduction</div>
            <div className="text-2xl font-bold text-green-900">
              {settings?.currency_symbol || '$'}{totalAmount.toFixed(2)}
            </div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium">Rate Method</div>
            <div className="text-lg font-bold text-purple-900">
              {settings?.vehicle_expense_method === 'standard' 
                ? `${settings.currency_symbol}${settings.mileage_rate}/mi` 
                : 'Actual Costs'}
            </div>
          </div>
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purpose</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Miles</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {mileageData.map((entry) => (
            <tr key={entry.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {new Date(entry.date).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-900">{entry.description}</td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {entry.vehicle_notes || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {parseFloat(entry.miles).toFixed(1)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                {settings?.currency_symbol || '$'}{parseFloat(entry.amount).toFixed(2)}
              </td>
            </tr>
          ))}
          {mileageData.length === 0 && (
            <tr>
              <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                No mileage entries for the selected date range.
              </td>
            </tr>
          )}
        </tbody>
        {mileageData.length > 0 && (
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan="3" className="px-6 py-4 text-sm font-bold text-gray-900">
                Total
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                {totalMiles.toFixed(1)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                {settings?.currency_symbol || '$'}{totalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

// Settings Component
const Settings = ({ settings, onSettingsUpdate }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          expense_categories: localSettings.expense_categories,
          mileage_rate: parseFloat(localSettings.mileage_rate),
          vehicle_expense_method: localSettings.vehicle_expense_method,
          currency_symbol: localSettings.currency_symbol,
          date_format: localSettings.date_format
        })
        .eq('id', settings.id);

      if (error) throw error;

      alert('Settings saved successfully!');
      onSettingsUpdate();
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if (!newCategory.trim()) return;
    if (localSettings.expense_categories.includes(newCategory.trim())) {
      alert('This category already exists');
      return;
    }
    
    setLocalSettings({
      ...localSettings,
      expense_categories: [...localSettings.expense_categories, newCategory.trim()]
    });
    setNewCategory('');
  };

  const removeCategory = (categoryToRemove) => {
    if (!confirm('Are you sure you want to remove this category?')) return;
    
    setLocalSettings({
      ...localSettings,
      expense_categories: localSettings.expense_categories.filter(cat => cat !== categoryToRemove)
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      <div className="space-y-6">
        {/* Expense Categories */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Expense Categories</h3>
          
          <div className="mb-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                placeholder="New category name..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
              />
              <button
                onClick={addCategory}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Add Category
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {localSettings?.expense_categories?.map((category) => (
              <div key={category} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-gray-900">{category}</span>
                <button
                  onClick={() => removeCategory(category)}
                  className="text-red-600 hover:text-red-900 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle/Mileage Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Car className="w-5 h-5 mr-2" />
            Vehicle & Mileage Settings
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Expense Method
              </label>
              <select
                value={localSettings?.vehicle_expense_method || 'standard'}
                onChange={(e) => setLocalSettings({ ...localSettings, vehicle_expense_method: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="standard">Standard Mileage Rate</option>
                <option value="actual">Actual Expenses</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                {localSettings?.vehicle_expense_method === 'standard' 
                  ? 'Uses the IRS standard mileage rate to calculate deductions automatically.'
                  : 'Tracks actual vehicle expenses (gas, maintenance, etc.).'}
              </p>
            </div>

            {localSettings?.vehicle_expense_method === 'standard' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Standard Mileage Rate (per mile)
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-900">{localSettings.currency_symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    value={localSettings?.mileage_rate || 0.67}
                    onChange={(e) => setLocalSettings({ ...localSettings, mileage_rate: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Current IRS standard mileage rate for 2024 is $0.67 per mile.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* General Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency Symbol
              </label>
              <input
                type="text"
                value={localSettings?.currency_symbol || '$'}
                onChange={(e) => setLocalSettings({ ...localSettings, currency_symbol: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                maxLength="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Format
              </label>
              <select
                value={localSettings?.date_format || 'MM/DD/YYYY'}
                onChange={(e) => setLocalSettings({ ...localSettings, date_format: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
