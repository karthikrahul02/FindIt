import { useState, useEffect } from "react";
import {
  Search, Bell, LayoutDashboard, Package,
  PlusCircle, SearchCheck, MapPin, Clock
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [imageUrls, setImageUrls] = useState({});

  const [form, setForm] = useState({
    name: "",
    category: "Electronics",
    location: "",
    description: ""
  });

  // Load reports from AWS
  useEffect(() => {
    async function loadItems() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/items`);

        if (!response.ok) {
          throw new Error("Could not load reports from AWS.");
        }

        const data = await response.json();
        setItems(data.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadItems();
  }, []);

  // Generate secure viewing URLs for uploaded S3 images
  useEffect(() => {
    let cancelled = false;

    async function loadImageUrls() {
      const imageItems = items.filter(item => item.imageKey);

      const results = await Promise.all(
        imageItems.map(async item => {
          try {
            const response = await fetch(
              `${API_URL}/image-url?key=${encodeURIComponent(item.imageKey)}`
            );

            if (!response.ok) return null;

            const data = await response.json();

            return {
              id: item.itemId || item.id,
              url: data.viewUrl
            };
          } catch {
            return null;
          }
        })
      );

      if (!cancelled) {
        const urls = {};

        results.forEach(result => {
          if (result?.url) {
            urls[result.id] = result.url;
          }
        });

        setImageUrls(urls);
      }
    }

    if (items.length > 0) {
      loadImageUrls();
    }

    return () => {
      cancelled = true;
    };
  }, [items]);

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Browse Items", icon: Search },
    { name: "Report Lost", icon: PlusCircle },
    { name: "Report Found", icon: Package },
    { name: "My Reports", icon: SearchCheck }
  ];

  const filteredItems = items.filter(item =>
    (item.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.category || "").toLowerCase().includes(search.toLowerCase()) ||
    (item.location || "").toLowerCase().includes(search.toLowerCase())
  );

  // Upload image to S3 and submit report to DynamoDB
  async function submitReport(e) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      let imageKey = "";

      // STEP 1: Upload selected image to S3
      if (selectedFile) {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp"
        ];

        if (!allowedTypes.includes(selectedFile.type)) {
          throw new Error("Please select a JPG, PNG or WEBP image.");
        }

        // Get secure upload URL from Lambda
        const urlResponse = await fetch(`${API_URL}/upload-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileName: selectedFile.name,
            contentType: selectedFile.type
          })
        });

        const urlData = await urlResponse.json();

        if (!urlResponse.ok) {
          throw new Error(urlData.error || "Could not generate upload URL.");
        }

        // Upload image directly to S3
        const uploadResponse = await fetch(urlData.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": selectedFile.type
          },
          body: selectedFile
        });

        if (!uploadResponse.ok) {
          throw new Error("Image upload to S3 failed.");
        }

        imageKey = urlData.key;
      }

      // STEP 2: Save report and image key in DynamoDB
      const response = await fetch(`${API_URL}/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...form,
          type: page === "Report Lost" ? "LOST" : "FOUND",
          ...(imageKey ? { imageKey } : {})
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Report submission failed.");
      }

      setItems(previous => [data.item, ...previous]);

      setForm({
        name: "",
        category: "Electronics",
        location: "",
        description: ""
      });

      setSelectedFile(null);

      alert(
        imageKey
          ? "Report saved! Image uploaded to AWS S3."
          : "Report successfully saved to AWS!"
      );

      setPage("My Reports");

    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Display item cards with uploaded S3 images
  function ItemCards({ data }) {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {data.map(item => (
          <div
            key={item.itemId || item.id}
            className="bg-white p-5 rounded-2xl border shadow-sm"
          >
            <div className="flex justify-between">
              <span className="text-3xl">📦</span>

              <span className={`text-xs font-bold px-3 py-2 rounded-full ${
                item.type === "FOUND"
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}>
                {item.type}
              </span>
            </div>

            <h3 className="font-bold text-lg mt-5">{item.name}</h3>
            <p className="text-sm text-slate-500">{item.category}</p>

            <p className="text-sm text-slate-500 mt-4 flex gap-2">
              <MapPin size={17}/> {item.location}
            </p>

            <p className="text-sm text-slate-400 mt-2 flex gap-2">
              <Clock size={17}/>
              {item.date || (
                item.createdAt
                  ? new Date(item.createdAt).toLocaleString()
                  : "Recently"
              )}
            </p>

            <p className="text-sm text-slate-500 mt-3">
              {item.description}
            </p>

            {item.imageKey && (
              <>
                {imageUrls[item.itemId || item.id] ? (
                  <img
                    src={imageUrls[item.itemId || item.id]}
                    alt={item.name}
                    className="w-full h-48 object-cover rounded-xl mt-4"
                  />
                ) : (
                  <p className="text-xs text-slate-400 mt-3">
                    Loading image...
                  </p>
                )}

                <p className="text-xs text-green-700 mt-3">
                  ✓ Image stored in AWS S3
                </p>
              </>
            )}
          </div>
        ))}

        {data.length === 0 && (
          <p className="text-slate-500">No items found.</p>
        )}
      </div>
    );
  }

  const isReportPage =
    page === "Report Lost" || page === "Report Found";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r p-6 hidden md:block">
        <h1 className="text-3xl font-black text-blue-700">FindIt.</h1>

        <p className="text-xs text-slate-400 mt-2 mb-10">
          CAMPUS RECOVERY PLATFORM
        </p>

        <p className="text-xs text-slate-400 font-bold mb-4">
          MAIN MENU
        </p>

        {navigation.map(({ name, icon: Icon }) => (
          <button
            key={name}
            onClick={() => setPage(name)}
            className={`w-full flex gap-3 p-3 mb-2 rounded-xl text-sm ${
              page === name
                ? "bg-blue-600 text-white"
                : "hover:bg-blue-50 text-slate-600"
            }`}
          >
            <Icon size={19}/> {name}
          </button>
        ))}
      </aside>

      <main className="md:ml-64">

        <header className="h-20 bg-white border-b px-6 md:px-10 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-400">CAMPUS PORTAL</p>
            <h2 className="font-bold text-lg">{page}</h2>
          </div>

          <div className="flex gap-4 items-center">
            <Bell/>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              K
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10">

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-slate-500">Loading reports from AWS...</p>
          ) : (
            <>

              {page === "Dashboard" && (
                <>
                  <section className="bg-gradient-to-r from-blue-700 to-indigo-600 text-white p-9 rounded-3xl">
                    <h1 className="text-3xl font-bold">
                      Lost something? Let's find it together.
                    </h1>

                    <p className="mt-4 text-blue-100">
                      Help your campus community recover lost belongings.
                    </p>

                    <button
                      onClick={() => setPage("Report Lost")}
                      className="mt-6 bg-white text-blue-700 px-6 py-3 rounded-xl font-bold"
                    >
                      Report an Item +
                    </button>
                  </section>

                  <div className="grid sm:grid-cols-3 gap-5 mt-8">
                    {[
                      ["Lost Items", items.filter(i => i.type === "LOST").length],
                      ["Found Items", items.filter(i => i.type === "FOUND").length],
                      ["Total Reports", items.length]
                    ].map(([label, value]) => (
                      <div key={label} className="bg-white p-6 rounded-2xl border">
                        <p className="text-slate-500">{label}</p>
                        <h2 className="text-3xl font-bold mt-3">{value}</h2>
                      </div>
                    ))}
                  </div>

                  <h2 className="font-bold text-xl mt-10 mb-5">
                    Recent Reports
                  </h2>

                  <ItemCards data={items.slice(0, 6)}/>
                </>
              )}

              {isReportPage && (
                <div className="bg-white rounded-2xl border p-6 md:p-8 max-w-2xl">
                  <h2 className="text-2xl font-bold">
                    {page === "Report Lost"
                      ? "Report a Lost Item"
                      : "Report a Found Item"}
                  </h2>

                  <p className="text-slate-500 mt-2 mb-7">
                    Provide the details below to submit your report.
                  </p>

                  <form onSubmit={submitReport} className="space-y-5">

                    <div>
                      <label className="block font-medium mb-2">
                        Item Name
                      </label>

                      <input
                        required
                        value={form.name}
                        onChange={e => setForm({...form, name: e.target.value})}
                        placeholder="Example: Black wallet"
                        className="w-full border rounded-xl p-3 outline-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-2">
                        Category
                      </label>

                      <select
                        value={form.category}
                        onChange={e => setForm({...form, category: e.target.value})}
                        className="w-full border rounded-xl p-3"
                      >
                        <option>Electronics</option>
                        <option>Accessories</option>
                        <option>Bags</option>
                        <option>Documents</option>
                        <option>Personal Items</option>
                        <option>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-medium mb-2">
                        Location
                      </label>

                      <input
                        required
                        value={form.location}
                        onChange={e => setForm({...form, location: e.target.value})}
                        placeholder="Where was it lost or found?"
                        className="w-full border rounded-xl p-3"
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-2">
                        Description
                      </label>

                      <textarea
                        required
                        value={form.description}
                        onChange={e => setForm({...form, description: e.target.value})}
                        placeholder="Describe the item..."
                        className="w-full border rounded-xl p-3 min-h-28"
                      />
                    </div>

                    <div>
                      <label className="block font-medium mb-2">
                        Upload Item Image (Optional)
                      </label>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                        className="w-full border rounded-xl p-3"
                      />

                      {selectedFile && (
                        <p className="text-sm text-green-700 mt-2">
                          Selected: {selectedFile.name}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="bg-blue-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50"
                    >
                      {submitting ? "Uploading and submitting..." : "Submit Report"}
                    </button>

                  </form>
                </div>
              )}

              {page === "Browse Items" && (
                <>
                  <h2 className="text-2xl font-bold mb-5">
                    Browse Campus Items
                  </h2>

                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, category or location..."
                    className="w-full max-w-lg border rounded-xl p-3 mb-7"
                  />

                  <ItemCards data={filteredItems}/>
                </>
              )}

              {page === "My Reports" && (
                <>
                  <h2 className="text-2xl font-bold mb-5">
                    My Reports
                  </h2>

                  <p className="text-slate-500 mb-6">
                    Reports currently retrieved from the AWS database.
                  </p>

                  <ItemCards data={items}/>
                </>
              )}

            </>
          )}

        </div>
      </main>
    </div>
  );
}