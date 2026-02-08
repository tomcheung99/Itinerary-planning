import { useState, useEffect } from 'react';

interface Location {
  id: string;
  name: string;
  address: string;
  notes?: string;
  images: string[];
}

interface Trip {
  id: string;
  name: string;
  locations: Location[];
  createdAt: number;
}

// UTF-8 safe base64 encoding
function utf8ToBase64(str: string): string {
  const utf8Bytes = new TextEncoder().encode(str);
  const binString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString);
}

function base64ToUtf8(base64: string): string {
  const binString = atob(base64);
  const bytes = Uint8Array.from(binString, (m) => m.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export default function TravelPlanner() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newTripName, setNewTripName] = useState('');
  const [newLocation, setNewLocation] = useState<{ name: string; address: string; notes: string; images: string[] }>({ name: '', address: '', notes: '', images: [] });
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState('');
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('travel-trips');
    if (saved) setTrips(JSON.parse(saved));
    
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const encoded = hash.replace('#share=', '');
        const decoded = JSON.parse(base64ToUtf8(decodeURIComponent(encoded)));
        if (decoded.name && decoded.locations) {
          setImportData(JSON.stringify(decoded, null, 2));
          setShowImportModal(true);
        }
      } catch (e) {
        console.error('Failed to parse shared trip');
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('travel-trips', JSON.stringify(trips));
  }, [trips]);

  const createTrip = () => {
    if (!newTripName.trim()) return;
    const trip: Trip = {
      id: Date.now().toString(),
      name: newTripName,
      locations: [],
      createdAt: Date.now(),
    };
    setTrips([...trips, trip]);
    setCurrentTrip(trip);
    setNewTripName('');
    setShowForm(false);
  };

  const deleteTrip = (id: string) => {
    setTrips(trips.filter(t => t.id !== id));
    if (currentTrip?.id === id) setCurrentTrip(null);
  };

  const handleNewImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setNewLocation(prev => ({ ...prev, images: [...prev.images, base64] }));
    };
    reader.readAsDataURL(file);
  };

  const removeNewImage = (index: number) => {
    setNewLocation(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const addLocation = () => {
    if (!newLocation.name.trim() || !newLocation.address.trim() || !currentTrip) return;
    const location: Location = {
      id: Date.now().toString(),
      name: newLocation.name,
      address: newLocation.address,
      notes: newLocation.notes,
      images: newLocation.images,
    };
    const updated = { ...currentTrip, locations: [...currentTrip.locations, location] };
    setCurrentTrip(updated);
    setTrips(trips.map(t => t.id === updated.id ? updated : t));
    setNewLocation({ name: '', address: '', notes: '', images: [] });
  };

  const removeLocation = (locId: string) => {
    if (!currentTrip) return;
    const updated = { ...currentTrip, locations: currentTrip.locations.filter(l => l.id !== locId) };
    setCurrentTrip(updated);
    setTrips(trips.map(t => t.id === updated.id ? updated : t));
  };

  const moveLocation = (index: number, direction: number) => {
    if (!currentTrip) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentTrip.locations.length) return;
    const locations = [...currentTrip.locations];
    [locations[index], locations[newIndex]] = [locations[newIndex], locations[index]];
    const updated = { ...currentTrip, locations };
    setCurrentTrip(updated);
    setTrips(trips.map(t => t.id === updated.id ? updated : t));
  };

  const openNavigation = (from: Location | null, to: Location) => {
    const destination = encodeURIComponent(to.address);
    let url: string;
    if (from) {
      const origin = encodeURIComponent(from.address);
      url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
    } else {
      url = `https://www.google.com/maps/search/?api=1&query=${destination}`;
    }
    window.open(url, '_blank');
  };

  const generateShareUrl = () => {
    if (!currentTrip) return;
    const data = {
      name: currentTrip.name,
      locations: currentTrip.locations.map(l => ({
        name: l.name,
        address: l.address,
        notes: l.notes,
      })),
    };
    const encoded = encodeURIComponent(utf8ToBase64(JSON.stringify(data)));
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
    setShareUrl(url);
    setShowShareModal(true);
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('連結已複製！');
  };

  const importSharedTrip = () => {
    try {
      const data = JSON.parse(importData);
      const trip: Trip = {
        id: Date.now().toString(),
        name: data.name + ' (分享)',
        locations: data.locations.map((l: any) => ({
          id: Date.now().toString() + Math.random().toString(),
          name: l.name,
          address: l.address,
          notes: l.notes || '',
          images: [],
        })),
        createdAt: Date.now(),
      };
      setTrips([...trips, trip]);
      setCurrentTrip(trip);
      setShowImportModal(false);
      window.location.hash = '';
    } catch (e) {
      alert('無效的行程資料');
    }
  };

  const openEditModal = (loc: Location) => {
    setEditingLocation({ ...loc });
    setShowEditModal(true);
  };

  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingLocation) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setEditingLocation(prev => prev ? { ...prev, images: [...prev.images, base64] } : null);
    };
    reader.readAsDataURL(file);
  };

  const removeEditImage = (index: number) => {
    if (!editingLocation) return;
    setEditingLocation({ ...editingLocation, images: editingLocation.images.filter((_, i) => i !== index) });
  };

  const saveLocationEdit = () => {
    if (!currentTrip || !editingLocation) return;
    const updated = {
      ...currentTrip,
      locations: currentTrip.locations.map(l =>
        l.id === editingLocation.id ? editingLocation : l
      ),
    };
    setCurrentTrip(updated);
    setTrips(trips.map(t => t.id === updated.id ? updated : t));
    setShowEditModal(false);
    setEditingLocation(null);
  };

  if (!currentTrip) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-gray-800">🗺️ 行程規劃</h1>
          
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-medium mb-4 hover:bg-blue-600"
            >
              + 新行程
            </button>
          ) : (
            <div className="bg-white p-4 rounded-lg shadow mb-4">
              <input
                type="text"
                placeholder="行程名稱（如：東京之旅）"
                value={newTripName}
                onChange={e => setNewTripName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 mb-3"
                onKeyDown={e => e.key === 'Enter' && createTrip()}
              />
              <div className="flex gap-2">
                <button
                  onClick={createTrip}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                >
                  建立
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {trips.length === 0 ? (
            <p className="text-gray-500 text-center py-8">暫無行程，建立一個吧！</p>
          ) : (
            <div className="space-y-3">
              {trips.sort((a, b) => b.createdAt - a.createdAt).map(trip => (
                <div key={trip.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                  <button
                    onClick={() => setCurrentTrip(trip)}
                    className="flex-1 text-left"
                  >
                    <div className="font-medium text-gray-800">{trip.name}</div>
                    <div className="text-sm text-gray-500">{trip.locations.length} 個地點</div>
                  </button>
                  <button
                    onClick={() => deleteTrip(trip.id)}
                    className="text-red-500 px-3 py-1 hover:bg-red-50 rounded"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-4 max-w-sm w-full">
              <h2 className="text-lg font-bold mb-3">📥 匯入分享的行程</h2>
              <p className="text-sm text-gray-600 mb-3">朋友分享了一個行程給你，要加入嗎？</p>
              <textarea
                value={importData}
                className="w-full border rounded-lg px-3 py-2 mb-3 h-32 text-xs"
                readOnly
              />
              <div className="flex gap-2">
                <button
                  onClick={importSharedTrip}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                >
                  加入我的行程
                </button>
                <button
                  onClick={() => { setShowImportModal(false); window.location.hash = ''; }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-4">
          <button
            onClick={() => setCurrentTrip(null)}
            className="text-gray-600 hover:text-gray-800 mr-3"
          >
            ← 返回
          </button>
          <h1 className="text-xl font-bold text-gray-800 flex-1">{currentTrip.name}</h1>
          <button
            onClick={generateShareUrl}
            className="bg-purple-500 text-white px-3 py-1 rounded-lg text-sm hover:bg-purple-600"
          >
            🔗 分享
          </button>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-4">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="地點名稱（如：淺草寺）"
              value={newLocation.name}
              onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
            <input
              type="text"
              placeholder="地址（Google Maps 可用）"
              value={newLocation.address}
              onChange={e => setNewLocation({ ...newLocation, address: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
            <textarea
              placeholder="備註（如：門票資訊、營業時間等）"
              value={newLocation.notes}
              onChange={e => setNewLocation({ ...newLocation, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 h-20"
            />

            {/* Image upload for new location */}
            {newLocation.images.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {newLocation.images.map((img, index) => (
                  <div key={index} className="relative">
                    <img
                      src={img}
                      alt={`預覽 ${index + 1}`}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeNewImage(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-800">
              <span className="bg-gray-100 px-3 py-1 rounded-lg">📷 加圖片 ({newLocation.images.length})</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleNewImageUpload}
                className="hidden"
              />
            </label>
            
            <button
              onClick={addLocation}
              className="w-full bg-green-500 text-white py-2 rounded-lg hover:bg-green-600"
            >
              + 加入地點
            </button>
          </div>
        </div>

        {currentTrip.locations.length === 0 ? (
          <p className="text-gray-500 text-center py-8">加入第一個地點開始規劃！</p>
        ) : (
          <div className="space-y-3">
            {currentTrip.locations.map((loc, index) => (
              <div key={loc.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {index + 1}
                      </span>
                      <span className="font-medium text-gray-800">{loc.name}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1 ml-7">{loc.address}</div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(loc)}
                      className="text-gray-500 hover:bg-gray-100 p-1 rounded"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeLocation(loc.id)}
                      className="text-red-500 hover:bg-red-50 p-1 rounded"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {loc.notes && (
                  <div className="ml-7 mt-2 p-2 bg-yellow-50 rounded text-sm text-gray-700">
                    📝 {loc.notes}
                  </div>
                )}

                {loc.images.length > 0 && (
                  <div className="ml-7 mt-2 flex gap-2 flex-wrap">
                    {loc.images.map((img, imgIndex) => (
                      <button
                        key={imgIndex}
                        onClick={() => setLightboxImage(img)}
                        className="relative"
                      >
                        <img
                          src={img}
                          alt={`${loc.name} ${imgIndex + 1}`}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="flex gap-2 mt-3 ml-7">
                  {index > 0 && (
                    <button
                      onClick={() => moveLocation(index, -1)}
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      ↑
                    </button>
                  )}
                  {index < currentTrip.locations.length - 1 && (
                    <button
                      onClick={() => moveLocation(index, 1)}
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                    >
                      ↓
                    </button>
                  )}
                  {index === 0 ? (
                    <button
                      onClick={() => openNavigation(null, loc)}
                      className="flex-1 bg-blue-500 text-white text-sm py-2 rounded-lg hover:bg-blue-600"
                    >
                      📍 查看位置
                    </button>
                  ) : (
                    <button
                      onClick={() => openNavigation(currentTrip.locations[index - 1], loc)}
                      className="flex-1 bg-blue-500 text-white text-sm py-2 rounded-lg hover:bg-blue-600"
                    >
                      🧭 從 {currentTrip.locations[index - 1].name} 出發
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-3">🔗 分享行程</h2>
            <p className="text-sm text-gray-600 mb-3">複製這個連結給朋友，他們就能看到你這份行程：</p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 border rounded-lg px-3 py-2 text-sm bg-gray-50"
              />
              <button
                onClick={copyShareUrl}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
              >
                複製
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {showEditModal && editingLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-3">✏️ 編輯地點</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="地點名稱"
                value={editingLocation.name}
                onChange={e => setEditingLocation({ ...editingLocation, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
              <input
                type="text"
                placeholder="地址"
                value={editingLocation.address}
                onChange={e => setEditingLocation({ ...editingLocation, address: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
              />
              <textarea
                placeholder="備註"
                value={editingLocation.notes || ''}
                onChange={e => setEditingLocation({ ...editingLocation, notes: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 h-20"
              />

              {/* Edit images */}
              {editingLocation.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {editingLocation.images.map((img, index) => (
                    <div key={index} className="relative">
                      <img
                        src={img}
                        alt={`圖片 ${index + 1}`}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeEditImage(index)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                <span className="bg-gray-100 px-3 py-1 rounded-lg">📷 加圖片</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImageUpload}
                  className="hidden"
                />
              </label>
              
              <div className="flex gap-2">
                <button
                  onClick={saveLocationEdit}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600"
                >
                  儲存
                </button>
                <button
                  onClick={() => { setShowEditModal(false); setEditingLocation(null); }}
                  className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setLightboxImage(null)}
          >
            ✕
          </button>
          <img 
            src={lightboxImage} 
            alt="放大檢視"
            className="max-w-full max-h-[90vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
