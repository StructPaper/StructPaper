'use client';

import React, { useState, useEffect, useRef } from 'react';
import { UniversalTemplateSchema } from '@/types/template-builder';
import {
  templateRegistry,
  importTemplateFromFile,
  exportTemplateToFile,
} from '@/lib/template-engine/storage';
import { BUILT_IN_TEMPLATES, CUSTOM_BLANK_TEMPLATE } from '@/data/templates';
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter,
  MoreVertical,
  Calendar,
  Sparkles,
  BookOpen,
  Download,
  Trash2,
  Copy,
  ExternalLink,
  Edit3,
  CheckCircle2,
  FolderArchive,
  ArrowUpDown,
  FileUp,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/DynamicIslandToast';

interface TemplateHubViewProps {
  onOpenStudio?: (schema: UniversalTemplateSchema) => void;
  onCreateBlank?: () => void;
}

export const TemplateHubView: React.FC<TemplateHubViewProps> = ({
  onOpenStudio,
  onCreateBlank,
}) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateBlank = () => {
    if (onCreateBlank) {
      onCreateBlank();
    } else {
      router.push('/templates/builder?preset=blank');
    }
  };

  const handleOpenStudio = (tmpl: UniversalTemplateSchema) => {
    if (onOpenStudio) {
      onOpenStudio(tmpl);
    } else {
      router.push(`/templates/builder?preset=${encodeURIComponent(tmpl.id)}`);
    }
  };

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name'>('date');
  const [systemTemplates, setSystemTemplates] = useState<UniversalTemplateSchema[]>(BUILT_IN_TEMPLATES);
  const [customTemplates, setCustomTemplates] = useState<UniversalTemplateSchema[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [isLoadingRemote, setIsLoadingRemote] = useState<boolean>(false);

  // Load custom templates and fetch registered templates from API
  useEffect(() => {
    // 1. Local custom templates
    setCustomTemplates(templateRegistry.getLocalCustomTemplates());

    // 2. Fetch remote system templates dynamically from /api/templates
    async function loadRemoteTemplates() {
      setIsLoadingRemote(true);
      try {
        const res = await fetch('/api/templates');
        if (res.ok) {
          const manifests = await res.json();
          if (Array.isArray(manifests) && manifests.length > 0) {
            const loadedList: UniversalTemplateSchema[] = [];
            for (const m of manifests) {
              const tmpl = await templateRegistry.loadTemplate(m.id);
              if (tmpl) loadedList.push(tmpl);
            }
            if (loadedList.length > 0) {
              setSystemTemplates(loadedList);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load remote template list, fallback to built-in files:', err);
      } finally {
        setIsLoadingRemote(false);
      }
    }

    loadRemoteTemplates();
  }, []);

  // Merge custom user templates + system templates (deduped by id)
  const allTemplates: UniversalTemplateSchema[] = [
    ...customTemplates,
    ...systemTemplates.filter(
      (p) => !customTemplates.some((c) => c.id === p.id) && p.id !== 'custom_blank_canvas'
    ),
  ];

  // Filter templates
  const filteredTemplates = allTemplates
    .filter((tmpl) => {
      // Search text
      const matchesSearch =
        tmpl.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tmpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tmpl.author.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Category filter
      if (filterCategory === 'custom') {
        return customTemplates.some((c) => c.id === tmpl.id);
      }
      if (filterCategory === 'vnuhcm') {
        return (
          tmpl.id.includes('vnuhcm') ||
          tmpl.institution?.includes('ĐHQG') ||
          tmpl.author.includes('ĐHQG')
        );
      }
      if (filterCategory === 'intl') {
        return (
          tmpl.id.includes('ieee') ||
          tmpl.id.includes('nature') ||
          tmpl.id.includes('elsevier')
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    });

  // Delete a user-saved template
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    templateRegistry.deleteCustomTemplate(id);
    setCustomTemplates(templateRegistry.getLocalCustomTemplates());
    toast.success('Xóa template', 'Đã xóa template khỏi thư viện');
    setActiveMenuId(null);
  };

  // Duplicate a template
  const handleDuplicateTemplate = (tmpl: UniversalTemplateSchema, e: React.MouseEvent) => {
    e.stopPropagation();
    const dup = templateRegistry.duplicateTemplate(tmpl);
    setCustomTemplates(templateRegistry.getLocalCustomTemplates());
    toast.success('Nhân bản', `Đã nhân bản "${tmpl.name}"`);
    setActiveMenuId(null);
  };

  // Export template to standard JSON file
  const handleExportTemplate = (tmpl: UniversalTemplateSchema, e: React.MouseEvent) => {
    e.stopPropagation();
    exportTemplateToFile(tmpl);
    toast.success('Xuất file JSON', `Đã tải xuống file template "${tmpl.name}"!`);
    setActiveMenuId(null);
  };

  // Import external template JSON file
  const handleImportFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importTemplateFromFile(file);
      if (res.success && res.schema) {
        templateRegistry.saveCustomTemplate(res.schema);
        setCustomTemplates(templateRegistry.getLocalCustomTemplates());
        toast.success(
          'Nạp file thành công',
          `Đã nhập và lưu template "${res.schema.name}" vào thư viện!`
        );
      } else {
        const firstErr =
          res.validation.errors[0]?.message ||
          'File JSON không đúng chuẩn cấu trúc StructPaper UniversalTemplateSchema';
        toast.error('Lỗi cấu trúc Template', firstErr);
      }
    } catch (err: any) {
      toast.error('Lỗi nạp file', err?.message || 'Không thể đọc file JSON');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Hidden File Input for Importing Template JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* 1. Header Search Bar & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Thư Viện & Tạo Template Mới</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-extrabold bg-[#78C841]/15 text-[#3b7317]">
              Studio v3.0
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Lưu trữ, tải lên hoặc xuất file JSON template bài báo học thuật theo chuẩn quốc tế và ĐHQG-HCM.
          </p>
        </div>

        {/* Search & Import Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Import JSON File Button */}
          <button
            onClick={handleImportFileClick}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 hover:border-[#78C841] text-slate-700 hover:text-[#2d5d11] rounded-2xl text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer shrink-0"
            title="Nạp file template .json từ máy tính của bạn"
          >
            <FileUp className="w-4 h-4 text-[#78C841]" />
            <span>Nạp file mẫu</span>
          </button>

          {/* Search Input Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm mẫu tạp chí..."
              className="w-full bg-white border border-slate-200/80 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 shadow-xs transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Top Section: "Bắt đầu một template mới" (Google Docs Start Section) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#78C841]" />
            <h2 className="text-sm font-extrabold text-slate-800 tracking-tight">
              Bắt đầu một template mới
            </h2>
          </div>

          <div className="text-xs text-slate-400 font-medium hidden sm:block">
            Tất cả template được nạp động từ file JSON chuẩn StructPaper
          </div>
        </div>

        {/* Row of Template Starters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
          {/* Card 1: Blank Document (+) */}
          <div
            onClick={handleCreateBlank}
            className="group cursor-pointer flex flex-col items-center"
          >
            <div className="w-full aspect-[210/280] rounded-2xl bg-white border-2 border-dashed border-slate-200 group-hover:border-[#78C841] group-hover:bg-[#78C841]/5 flex flex-col items-center justify-center shadow-xs transition-all duration-200 group-hover:shadow-md group-hover:scale-102">
              <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-white flex items-center justify-center shadow-2xs transition-all group-hover:scale-110">
                <Plus className="w-8 h-8 text-[#78C841] stroke-[2.8]" />
              </div>
              <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#2d5d11] mt-3">
                Template trống
              </span>
            </div>
            <div className="w-full text-center mt-2">
              <div className="text-xs font-bold text-slate-900 group-hover:text-[#78C841] truncate">
                Tạo từ trang trắng
              </div>
              <div className="text-[10px] text-slate-400 truncate">Tự do thiết kế A-Z</div>
            </div>
          </div>

          {/* Quick Starter Presets loaded dynamically */}
          {systemTemplates.slice(0, 5).map((preset) => (
            <div
              key={preset.id}
              onClick={() => handleOpenStudio(preset)}
              className="group cursor-pointer flex flex-col items-center"
            >
              {/* Mini A4 Document Simulation Thumbnail */}
              <div className="w-full aspect-[210/280] rounded-2xl bg-white border border-slate-200/90 group-hover:border-[#78C841] p-2.5 flex flex-col justify-between shadow-xs transition-all duration-200 group-hover:shadow-md group-hover:scale-102 overflow-hidden relative">
                {/* Top header line */}
                <div className="space-y-1">
                  <div
                    className="h-1 w-8 rounded-full"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                  <div className="h-0.5 w-full bg-slate-200" />
                </div>

                {/* Simulated content lines based on layout */}
                <div className="flex-1 my-1.5 flex flex-col justify-center space-y-1">
                  <div className="h-1.5 w-3/4 rounded bg-slate-800" />
                  <div className="h-1 w-1/2 rounded bg-slate-400" />

                  {/* Layout split or 2 cols */}
                  {preset.zones.some((z) => z.type === 'sidebar-split') ? (
                    <div className="grid grid-cols-12 gap-1 pt-1">
                      <div className="col-span-4 bg-slate-100 rounded p-0.5 space-y-0.5">
                        <div className="h-0.5 w-full bg-slate-300" />
                        <div className="h-0.5 w-3/4 bg-slate-300" />
                      </div>
                      <div className="col-span-8 bg-blue-50/60 rounded p-0.5 space-y-0.5">
                        <div className="h-0.5 w-full bg-slate-300" />
                        <div className="h-0.5 w-4/5 bg-slate-300" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      <div className="space-y-0.5">
                        <div className="h-0.5 w-full bg-slate-300" />
                        <div className="h-0.5 w-full bg-slate-300" />
                        <div className="h-0.5 w-4/5 bg-slate-300" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="h-0.5 w-full bg-slate-300" />
                        <div className="h-0.5 w-full bg-slate-300" />
                        <div className="h-0.5 w-3/4 bg-slate-300" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom line */}
                <div className="flex items-center justify-between text-[7px] text-slate-400 font-mono">
                  <span>{preset.pageArchitecture?.size || 'A4'}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: preset.primaryColor }}
                  />
                </div>
              </div>

              {/* Title & Category info below card */}
              <div className="w-full text-center mt-2 px-1">
                <div className="text-xs font-bold text-slate-800 group-hover:text-slate-950 truncate">
                  {preset.name.split('(')[0].trim()}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {preset.institution || preset.author}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Bottom Section: "Template gần đây & Thư viện của bạn" (Google Docs Recent Section) */}
      <div className="space-y-4 pt-4 border-t border-slate-200/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderArchive className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
              Template gần đây & Thư viện mẫu
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {filteredTemplates.length} mẫu
            </span>
            {isLoadingRemote && (
              <span className="flex items-center gap-1 text-[11px] text-slate-400 ml-2">
                <Loader2 className="w-3 h-3 animate-spin text-[#78C841]" />
                Đang đồng bộ file...
              </span>
            )}
          </div>

          {/* Right Controls: Filters, Sort, View mode */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'custom', label: 'Của tôi' },
                { id: 'vnuhcm', label: 'ĐHQG-HCM' },
                { id: 'intl', label: 'Quốc tế' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterCategory(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    filterCategory === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date' | 'name')}
              className="bg-slate-100 text-slate-700 text-xs font-medium rounded-xl px-2.5 py-1.5 border-0 outline-none cursor-pointer"
            >
              <option value="date">Sắp xếp: Mới nhất</option>
              <option value="name">Sắp xếp: Tên A-Z</option>
            </select>

            {/* View Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Dạng lưới"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Dạng danh sách"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 4. Template Display Area */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTemplates.map((tmpl) => {
              const isCustom = customTemplates.some((c) => c.id === tmpl.id);
              const isMenuOpen = activeMenuId === tmpl.id;

              return (
                <div
                  key={tmpl.id}
                  onClick={() => handleOpenStudio(tmpl)}
                  className="bg-white rounded-2xl border border-slate-200/80 hover:border-[#78C841] hover:shadow-md transition-all duration-200 p-4 flex flex-col justify-between cursor-pointer group relative"
                >
                  <div>
                    {/* Top Tag & Context Menu */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white shadow-2xs"
                        style={{ backgroundColor: tmpl.primaryColor }}
                      >
                        {isCustom ? 'MẪU CỦA TÔI' : tmpl.institution || 'MẪU CHUẨN'}
                      </span>

                      {/* 3-Dot Actions Menu */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() =>
                            setActiveMenuId(isMenuOpen ? null : tmpl.id)
                          }
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Menu Dropdown */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-6 z-20 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95">
                            <button
                              onClick={() => {
                                handleOpenStudio(tmpl);
                                setActiveMenuId(null);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 font-medium"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Mở trong Studio</span>
                            </button>
                            <button
                              onClick={(e) => handleDuplicateTemplate(tmpl, e)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 font-medium"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-600" />
                              <span>Nhân bản mẫu</span>
                            </button>
                            <button
                              onClick={(e) => handleExportTemplate(tmpl, e)}
                              className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 font-medium"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Tải file mẫu (.json)</span>
                            </button>
                            {isCustom && (
                              <button
                                onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                                className="w-full px-3 py-2 text-left hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium border-t border-slate-100"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa template này</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Paper Document Preview Thumbnail */}
                    <div className="w-full aspect-[210/140] rounded-xl bg-slate-50 border border-slate-200/70 p-3 mb-3 flex flex-col justify-between group-hover:bg-[#78C841]/5 transition-colors">
                      <div className="space-y-1">
                        <div
                          className="h-1.5 w-1/2 rounded"
                          style={{ backgroundColor: tmpl.primaryColor }}
                        />
                        <div className="h-1 w-full bg-slate-200 rounded" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="h-0.5 w-full bg-slate-300 rounded" />
                          <div className="h-0.5 w-3/4 bg-slate-300 rounded" />
                        </div>
                        <div className="space-y-1">
                          <div className="h-0.5 w-full bg-slate-300 rounded" />
                          <div className="h-0.5 w-2/3 bg-slate-300 rounded" />
                        </div>
                      </div>

                      <div className="text-[9px] text-slate-400 font-mono flex items-center justify-between">
                        <span>{tmpl.pageArchitecture.size}</span>
                        <span>{tmpl.zones.length} zones</span>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#78C841] transition-colors line-clamp-1">
                      {tmpl.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {tmpl.description}
                    </p>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {tmpl.updatedAt}
                    </span>
                    <span className="font-semibold text-slate-600">v{tmpl.version}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List Mode */
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100">
            {filteredTemplates.map((tmpl) => {
              const isCustom = customTemplates.some((c) => c.id === tmpl.id);

              return (
                <div
                  key={tmpl.id}
                  onClick={() => handleOpenStudio(tmpl)}
                  className="p-3 sm:p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-2xs"
                      style={{ backgroundColor: tmpl.primaryColor }}
                    >
                      <BookOpen className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 hover:text-[#78C841] truncate">
                          {tmpl.name}
                        </span>
                        {isCustom && (
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                            Của tôi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
                    <span className="hidden sm:inline font-mono">{tmpl.pageArchitecture.size}</span>
                    <span className="hidden md:inline font-medium">{tmpl.author}</span>
                    <span className="text-[11px] text-slate-400">{tmpl.updatedAt}</span>

                    <button
                      onClick={(e) => handleExportTemplate(tmpl, e)}
                      className="p-1.5 rounded-xl border border-slate-200 hover:border-[#78C841] text-slate-600 hover:text-[#2d5d11] transition-all"
                      title="Tải xuống file template .json"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenStudio(tmpl);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all"
                    >
                      Mở Studio
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredTemplates.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Search className="w-6 h-6" />
            </div>
            <div className="text-sm font-bold text-slate-700">
              Không tìm thấy mẫu template nào phù hợp
            </div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Thử tìm kiếm với từ khóa khác hoặc bấm "+ Template trống" để tạo một mẫu mới.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
