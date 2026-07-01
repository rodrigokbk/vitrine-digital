import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import {
  collection, doc, getDoc, setDoc, onSnapshot,
  addDoc, updateDoc, deleteDoc, query, where, getDocs
} from "firebase/firestore";

const WHATSAPP_MASTER = "5521966882000";
const MASTER_EMAIL = "rodrigo.kbk@gmail.com";

const slugify = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const diasParaVencer = (dataVencimento) => {
  if (!dataVencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  return Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
};

const statusVencimento = (dataVencimento) => {
  const dias = diasParaVencer(dataVencimento);
  if (dias === null) return null;
  if (dias < 0) return { label: "Vencido", color: "#ff4757", bg: "#fff0f2", icon: "🔴" };
  if (dias === 0) return { label: "Vence hoje!", color: "#ff4757", bg: "#fff0f2", icon: "🚨" };
  if (dias <= 3) return { label: `Vence em ${dias} dia${dias > 1 ? "s" : ""}`, color: "#ff6b6b", bg: "#fff0f2", icon: "⚠️" };
  if (dias <= 7) return { label: `Vence em ${dias} dias`, color: "#ffa502", bg: "#fff8e1", icon: "⏰" };
  return { label: `Vence em ${dias} dias`, color: "#2ed573", bg: "#f0fff4", icon: "✅" };
};

const adicionarMes = (data) => {
  const d = data ? new Date(data) : new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().split("T")[0];
};

function Notification({ msg, type }) {
  if (!msg) return null;
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: type === "error" ? "#ff4757" : "#2ed573", color: "white", padding: "12px 22px", borderRadius: 12, fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", animation: "slideIn 0.3s ease" }}>
      {msg}
    </div>
  );
}

function ImageCarousel({ images, fallback = "🛍️", size = "card" }) {
  const [idx, setIdx] = useState(0);
  const h = size === "card" ? 200 : 320;
  if (!images || images.length === 0)
    return <div style={{ height: h, background: "#f5f0eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size === "card" ? 52 : 72, borderRadius: size === "card" ? "14px 14px 0 0" : 14 }}>{fallback}</div>;
  return (
    <div style={{ position: "relative", height: h, overflow: "hidden", borderRadius: size === "card" ? "14px 14px 0 0" : 14, background: "#f0ebe5" }}>
      <img src={images[idx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {images.length > 1 && <>
        <button onClick={() => setIdx((idx - 1 + images.length) % images.length)} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "white", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>‹</button>
        <button onClick={() => setIdx((idx + 1) % images.length)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "rgba(0,0,0,0.4)", color: "white", border: "none", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontSize: 14 }}>›</button>
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4 }}>
          {images.map((_, i) => <div key={i} onClick={() => setIdx(i)} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, background: i === idx ? "white" : "rgba(255,255,255,0.5)", cursor: "pointer", transition: "all 0.2s" }} />)}
        </div>
      </>}
      <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.4)", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>{idx + 1}/{images.length}</div>
    </div>
  );
}

function ImageUploader({ images, onChange }) {
  const handleFiles = (e) => {
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => onChange(p => [...p, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: "#666", display: "block", marginBottom: 8 }}>📸 FOTOS DO PRODUTO</label>
      <div onClick={() => document.getElementById("imgUploadInput").click()}
        style={{ border: "2px dashed #c9a96e", borderRadius: 12, padding: "18px 16px", textAlign: "center", cursor: "pointer", background: "#fffdf9", marginBottom: 10 }}>
        <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
        <div style={{ fontWeight: 700, color: "#c9a96e", fontSize: 13 }}>Clique para adicionar fotos</div>
        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>JPG, PNG, WEBP · várias de uma vez</div>
      </div>
      <input id="imgUploadInput" type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: "none" }} />
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 8 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: i === 0 ? "2px solid #c9a96e" : "2px solid #e8e0d8", aspectRatio: "1" }}>
              <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {i === 0 && <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: "rgba(201,169,110,0.85)", color: "white", fontSize: 8, fontWeight: 700, textAlign: "center", padding: "1px 0" }}>CAPA</div>}
              <button onClick={() => onChange(p => p.filter((_, j) => j !== i))} style={{ position: "absolute", top: 2, right: 2, background: "rgba(255,71,87,0.85)", color: "white", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LandingPage({ onGoToLogin, onGoToRegister }) {
  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#e8f5e9", color: "#1a1a1a", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
        * { box-sizing: border-box; } body { margin: 0; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
        .hero-emoji { animation: float 3s ease-in-out infinite; }
        .fade1 { animation: fadeUp 0.7s ease both; }
        .fade2 { animation: fadeUp 0.7s 0.15s ease both; }
        .fade3 { animation: fadeUp 0.7s 0.3s ease both; }
        .fade4 { animation: fadeUp 0.7s 0.45s ease both; }
        .card-feat:hover { transform: translateY(-6px); background: rgba(201,169,110,0.12) !important; }
        .btn-cta:hover { transform: scale(1.04); }
        .btn-outline:hover { background: rgba(0,0,0,0.06) !important; }
      `}</style>
      <div style={{ padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#c9a96e" }}>Vitrine Digital</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onGoToLogin} className="btn-outline" style={{ background: "transparent", border: "1.5px solid rgba(0,0,0,0.3)", color: "white", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 600, transition: "all 0.2s" }}>Entrar</button>
          <button onClick={onGoToRegister} className="btn-cta" style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 10, padding: "9px 20px", cursor: "pointer", fontSize: 14, fontWeight: 700, transition: "all 0.2s" }}>Criar minha loja</button>
        </div>
      </div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "80px 40px 60px", textAlign: "center" }}>
        <div className="hero-emoji" style={{ fontSize: 72, marginBottom: 24 }}>🛍️</div>
        <h1 className="fade1" style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, margin: "0 0 20px", lineHeight: 1.1 }}>
          Sua loja online em<br /><span style={{ color: "#c9a96e" }}>minutos</span>
        </h1>
        <p className="fade2" style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "rgba(0,0,0,0.6)", margin: "0 0 40px", lineHeight: 1.7, maxWidth: 580, marginLeft: "auto", marginRight: "auto" }}>
          Crie sua vitrine virtual, gerencie produtos, controle finanças e receba pedidos direto no WhatsApp. Sem complicação.
        </p>
        <div className="fade3" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onGoToRegister} className="btn-cta" style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 14, padding: "16px 36px", cursor: "pointer", fontSize: 16, fontWeight: 700, transition: "all 0.2s", boxShadow: "0 4px 20px rgba(201,169,110,0.3)" }}>
            Começar grátis →
          </button>
          <a href={`https://wa.me/${WHATSAPP_MASTER}?text=Olá! Quero saber mais sobre a Vitrine Digital`} target="_blank" rel="noreferrer"
            style={{ background: "#25D366", color: "white", border: "none", borderRadius: 14, padding: "16px 28px", cursor: "pointer", fontSize: 15, fontWeight: 700, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            💬 Falar no WhatsApp
          </a>
        </div>
      </div>
      <div className="fade4" style={{ maxWidth: 1000, margin: "0 auto", padding: "0 40px 80px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
        {[
          { icon: "🛍️", title: "Vitrine Bonita", desc: "Seus clientes veem produtos com fotos, preços e botão de WhatsApp" },
          { icon: "📦", title: "Controle de Estoque", desc: "Gerencie produtos, quantidades e receba alertas de estoque baixo" },
          { icon: "📊", title: "Finanças", desc: "Registre receitas e despesas, veja seu lucro em tempo real" },
          { icon: "💬", title: "WhatsApp Integrado", desc: "Clientes enviam mensagem com um clique direto para você" },
        ].map((f, i) => (
          <div key={i} className="card-feat" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 18, padding: "28px 24px", transition: "all 0.25s" }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>{f.icon}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: "rgba(0,0,0,0.55)", lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "40px 40px 60px", borderTop: "1px solid rgba(0,0,0,0.08)" }}>
        <p style={{ color: "rgba(0,0,0,0.4)", fontSize: 13, margin: "0 0 8px" }}>Pronto para começar?</p>
        <button onClick={onGoToRegister} className="btn-cta" style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 14, padding: "14px 32px", cursor: "pointer", fontSize: 15, fontWeight: 700, transition: "all 0.2s" }}>
          Criar minha vitrine grátis →
        </button>
        <p style={{ color: "rgba(0,0,0,0.3)", fontSize: 12, marginTop: 16 }}>Vitrine Digital · {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

function AuthScreen({ mode, onSuccess, onToggle, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handle = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!storeName) { setError("Digite o nome da sua loja."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const slug = slugify(storeName);
        await setDoc(doc(db, "lojas", cred.user.uid), {
          storeName, slug, whatsapp, email,
          plano: "gratis", ativo: false, aprovado: false,
          criadoEm: new Date().toISOString()
        });
        const msg = encodeURIComponent(`🛍️ Nova loja aguardando aprovação!\nLoja: *${storeName}*\nEmail: ${email}\nAcesse o painel master para aprovar.`);
        window.open(`https://wa.me/5521966882000?text=${msg}`, "_blank");
      }
      onSuccess();
    } catch (e) {
      const msgs = { "auth/email-already-in-use": "Email já cadastrado.", "auth/wrong-password": "Senha incorreta.", "auth/user-not-found": "Email não encontrado.", "auth/weak-password": "Senha muito fraca (mín. 6 caracteres).", "auth/invalid-email": "Email inválido." };
      setError(msgs[e.code] || "Erro ao autenticar.");
      setLoading(false);
    }
  };

  const iStyle = { width: "100%", padding: "12px 16px", border: "1.5px solid #e8e0d8", borderRadius: 12, fontSize: 15, outline: "none", fontFamily: "inherit" };
  const lStyle = { fontSize: 12, fontWeight: 700, color: "#666", display: "block", marginBottom: 6 };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #faf7f4, #f0e8de)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap'); * { box-sizing:border-box; } body { margin:0; } @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} } .acard{animation:fadeUp 0.5s ease both;} input:focus{border-color:#c9a96e!important;outline:none;}`}</style>
      <div className="acard" style={{ background: "white", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.1)", border: "1px solid #f0ebe5" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 13, marginBottom: 20, padding: 0 }}>← Voltar</button>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛍️</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 4px" }}>Vitrine Digital</h2>
          <p style={{ color: "#aaa", margin: 0, fontSize: 13 }}>{mode === "login" ? "Entre na sua conta" : "Crie sua loja grátis"}</p>
        </div>
        <div style={{ display: "grid", gap: 14 }}>
          {mode === "register" && (
            <>
              <div><label style={lStyle}>NOME DA LOJA</label><input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Ex: Loja da Maria" style={iStyle} /></div>
              <div><label style={lStyle}>WHATSAPP DA LOJA</label><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5521999999999" style={iStyle} /></div>
            </>
          )}
          <div><label style={lStyle}>EMAIL</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="seu@email.com" style={iStyle} /></div>
          <div><label style={lStyle}>SENHA</label>
            <div style={{ position: "relative" }}>
              <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} placeholder="mínimo 6 caracteres" style={{ ...iStyle, paddingRight: 44 }} />
              <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#aaa" }}>{showPass ? "🙈" : "👁️"}</button>
            </div>
          </div>
          {error && <div style={{ background: "#fff0f2", border: "1.5px solid #ffb3be", borderRadius: 10, padding: "10px 14px", color: "#c0392b", fontSize: 13, fontWeight: 600 }}>⚠️ {error}</div>}
          <button onClick={handle} style={{ background: loading ? "#ddd" : "#c9a96e", color: "white", border: "none", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", marginTop: 4 }}>
            {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha loja"}
          </button>
        </div>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#888" }}>
          {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
          <span onClick={onToggle} style={{ color: "#c9a96e", fontWeight: 700, cursor: "pointer" }}>
            {mode === "login" ? "Criar grátis" : "Entrar"}
          </span>
        </p>
      </div>
    </div>
  );
}
function VitrinePublica({ lojaData, products }) {
  const [filterCat, setFilterCat] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const categories = ["Todos", ...new Set(products.map(p => p.category))];
  const filtered = products.filter(p => (filterCat === "Todos" || p.category === filterCat) && p.name.toLowerCase().includes(search.toLowerCase()));

  const openWA = (p) => {
    const msg = encodeURIComponent(`Olá! Tenho interesse no produto: *${p.name}* (R$ ${Number(p.price).toFixed(2)}). Ainda tem disponível?`);
    window.open(`https://wa.me/${(lojaData.whatsapp || "").replace(/\D/g, "")}?text=${msg}`, "_blank");
  };

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#faf7f4" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap'); *{box-sizing:border-box;} body{margin:0;} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .pcard{animation:fadeUp 0.4s ease both;transition:all 0.25s;cursor:pointer;} .pcard:hover{transform:translateY(-5px);box-shadow:0 14px 36px rgba(0,0,0,0.12)!important;}`}</style>

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 460, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <ImageCarousel images={selected.images || []} size="modal" />
            <div style={{ padding: "20px 24px 26px" }}>
              <div style={{ fontSize: 10, color: "#c9a96e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>{selected.category}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: "#777", marginBottom: 16, lineHeight: 1.6 }}>{selected.description}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: "#c9a96e" }}>R$ {Number(selected.price).toFixed(2)}</span>
                <span style={{ fontSize: 11, color: selected.stock <= 3 ? "#ff4757" : "#2ed573", fontWeight: 600, background: selected.stock <= 3 ? "#fff0f2" : "#f0fff4", padding: "3px 10px", borderRadius: 20 }}>
                  {selected.stock <= 3 ? `⚠️ Últimas ${selected.stock}` : `✓ ${selected.stock} em estoque`}
                </span>
              </div>
              <button onClick={() => { openWA(selected); setSelected(null); }} disabled={selected.stock === 0}
                style={{ width: "100%", background: "#25D366", color: "white", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                💬 Quero este! (WhatsApp)
              </button>
              <button onClick={() => setSelected(null)} style={{ width: "100%", marginTop: 8, background: "#f5f0eb", border: "none", borderRadius: 12, padding: "11px 0", fontWeight: 700, cursor: "pointer", fontSize: 13, color: "#666" }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "white", borderBottom: "1px solid #f0ebe5", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700 }}>{lojaData.storeName}</div>
          <div style={{ fontSize: 10, color: "#c9a96e", letterSpacing: 2, textTransform: "uppercase" }}>Loja Online</div>
        </div>
        <a href={`https://wa.me/${(lojaData.whatsapp || "").replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
          style={{ background: "#25D366", color: "white", borderRadius: 10, padding: "9px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          💬 WhatsApp
        </a>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar produto..."
            style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e8e0d8", fontSize: 14, background: "white", flex: 1, minWidth: 160, outline: "none" }} />
          {categories.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              style={{ padding: "7px 14px", borderRadius: 20, border: `1.5px solid ${filterCat === c ? "#c9a96e" : "#e8e0d8"}`, background: filterCat === c ? "#c9a96e" : "white", color: filterCat === c ? "white" : "#555", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.2s" }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 18 }}>
          {filtered.map((p, i) => (
            <div key={p.id} className="pcard" style={{ animationDelay: `${i * 0.06}s`, background: "white", borderRadius: 16, boxShadow: "0 4px 14px rgba(0,0,0,0.07)", border: "1px solid #f0ebe5", overflow: "hidden" }} onClick={() => setSelected(p)}>
              <ImageCarousel images={p.images || []} size="card" />
              <div style={{ padding: "14px 16px 18px" }}>
                <div style={{ fontSize: 10, color: "#c9a96e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>{p.category}</div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, marginBottom: 3 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#999", marginBottom: 10, lineHeight: 1.4, height: 30, overflow: "hidden" }}>{p.description}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: "#c9a96e" }}>R$ {Number(p.price).toFixed(2)}</span>
                  <span style={{ fontSize: 10, color: p.stock <= 3 ? "#ff4757" : "#2ed573", fontWeight: 600, background: p.stock <= 3 ? "#fff0f2" : "#f0fff4", padding: "2px 8px", borderRadius: 20 }}>
                    {p.stock === 0 ? "Esgotado" : p.stock <= 3 ? `⚠️ ${p.stock} rest.` : "✓ Disponível"}
                  </span>
                </div>
                <button onClick={e => { e.stopPropagation(); openWA(p); }} disabled={p.stock === 0}
                  style={{ width: "100%", background: p.stock === 0 ? "#ccc" : "#25D366", color: "white", border: "none", borderRadius: 10, padding: "10px 0", fontSize: 12, fontWeight: 700, cursor: p.stock === 0 ? "not-allowed" : "pointer" }}>
                  {p.stock === 0 ? "Esgotado" : "💬 Quero este!"}
                </button>
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#bbb" }}>Nenhum produto encontrado 🔍</div>}
        <div style={{ textAlign: "center", marginTop: 40, paddingTop: 20, borderTop: "1px solid #f0ebe5", fontSize: 11, color: "#ddd" }}>
          {lojaData.storeName} · Powered by <span style={{ color: "#c9a96e", fontWeight: 700 }}>Vitrine Digital</span>
        </div>
      </div>
    </div>
  );
}

function PainelAdmin({ user, lojaData, onLogout, onUpdateLoja }) {
  const [view, setView] = useState("vitrine");
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [notification, setNotification] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showTxForm, setShowTxForm] = useState(null);
  const [editProduct, setEditProduct] = useState(null);
  const [selected, setSelected] = useState(null);
  const [finTab, setFinTab] = useState("todos");
  const [storeName, setStoreName] = useState(lojaData.storeName || "");
  const [whatsapp, setWhatsapp] = useState(lojaData.whatsapp || "");
  const emptyProd = { name: "", price: "", stock: "", category: "Roupas", description: "", images: [] };
  const [newProd, setNewProd] = useState(emptyProd);
  const emptyTx = { description: "", amount: "", date: "", category: "Venda", type: "receita" };
  const [newTx, setNewTx] = useState(emptyTx);
  const lojaId = user.uid;

  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); };

  useEffect(() => {
    const unP = onSnapshot(collection(db, "lojas", lojaId, "products"), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unT = onSnapshot(collection(db, "lojas", lojaId, "transactions"), snap => setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { unP(); unT(); };
  }, [lojaId]);

  const saveProd = async () => {
    if (!newProd.name || !newProd.price || !newProd.stock) return notify("Preencha todos os campos!", "error");
    try {
      if (editProduct) {
        await updateDoc(doc(db, "lojas", lojaId, "products", editProduct.id), { ...newProd, price: Number(newProd.price), stock: Number(newProd.stock) });
        notify("Produto atualizado!");
      } else {
        await addDoc(collection(db, "lojas", lojaId, "products"), { ...newProd, price: Number(newProd.price), stock: Number(newProd.stock) });
        notify("Produto adicionado!");
      }
      setNewProd(emptyProd); setEditProduct(null); setShowProductForm(false);
    } catch { notify("Erro ao salvar!", "error"); }
  };

  const delProd = async (id) => { try { await deleteDoc(doc(db, "lojas", lojaId, "products", id)); notify("Removido!"); } catch { notify("Erro!", "error"); } };

  const saveTx = async () => {
    if (!newTx.description || !newTx.amount || !newTx.date) return notify("Preencha todos os campos!", "error");
    try {
      await addDoc(collection(db, "lojas", lojaId, "transactions"), { ...newTx, amount: Number(newTx.amount) });
      notify("Lançamento salvo!"); setNewTx(emptyTx); setShowTxForm(null);
    } catch { notify("Erro!", "error"); }
  };

  const delTx = async (id) => { try { await deleteDoc(doc(db, "lojas", lojaId, "transactions", id)); notify("Removido!"); } catch { notify("Erro!", "error"); } };

  const saveConfig = async () => {
    try {
      await updateDoc(doc(db, "lojas", lojaId), { storeName, whatsapp });
      onUpdateLoja({ ...lojaData, storeName, whatsapp });
      notify("Configurações salvas!");
    } catch { notify("Erro ao salvar!", "error"); }
  };

  const totalStock = products.reduce((s, p) => s + Number(p.stock), 0);
  const lowStock = products.filter(p => Number(p.stock) <= 3);
  const receitas = transactions.filter(t => t.type === "receita");
  const despesas = transactions.filter(t => t.type === "despesa");
  const totalR = receitas.reduce((s, t) => s + Number(t.amount), 0);
  const totalD = despesas.reduce((s, t) => s + Number(t.amount), 0);
  const lucro = totalR - totalD;

  const iStyle = { width: "100%", padding: "10px 14px", border: "1.5px solid #e8e0d8", borderRadius: 10, fontSize: 14, outline: "none" };
  const lStyle = { fontSize: 12, fontWeight: 700, color: "#666", display: "block", marginBottom: 5 };
  const tabs = [{ id: "vitrine", icon: "🛍️", label: "Vitrine" }, { id: "inventario", icon: "📦", label: "Inventário" }, { id: "financas", icon: "📊", label: "Finanças" }, { id: "config", icon: "⚙️", label: "Config" }];

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#faf7f4" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap'); *{box-sizing:border-box;} body{margin:0;} @keyframes slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .card{animation:fadeUp 0.4s ease both;} .tab-btn:hover{background:#f0ebe5!important;} .tab-btn.active{background:#c9a96e!important;color:white!important;} .pcard{transition:all 0.25s;cursor:pointer;} .pcard:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(0,0,0,0.1)!important;} input:focus,select:focus{border-color:#c9a96e!important;outline:none;}`}</style>

      <Notification msg={notification?.msg} type={notification?.type} />

      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }} onClick={() => setSelected(null)}>
          <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 460, overflow: "hidden" }} onClick={e => e.stopPropagation()}>
            <ImageCarousel images={selected.images || []} size="modal" />
            <div style={{ padding: "20px 24px 26px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: "#777", marginBottom: 14 }}>{selected.description}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#c9a96e" }}>R$ {Number(selected.price).toFixed(2)}</span>
                <span style={{ fontSize: 12, color: selected.stock <= 3 ? "#ff4757" : "#2ed573", fontWeight: 600 }}>{selected.stock} em estoque</span>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: "100%", background: "#f5f0eb", border: "none", borderRadius: 12, padding: "12px 0", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: "white", borderBottom: "1px solid #f0ebe5", padding: "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>{lojaData.storeName}</div>
          <div style={{ fontSize: 10, color: "#999", letterSpacing: 2, textTransform: "uppercase" }}>Painel Admin</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {lowStock.length > 0 && <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: "#856404", fontWeight: 600 }}>⚠️ {lowStock.length} baixo</div>}
          <a href={`/loja/${lojaData.slug}`} target="_blank" rel="noreferrer" style={{ background: "#f5f0eb", color: "#8a7055", borderRadius: 8, padding: "7px 12px", fontWeight: 600, cursor: "pointer", fontSize: 12, textDecoration: "none" }}>🔗 Ver Vitrine</a>
          <button onClick={onLogout} style={{ background: "#fff0f2", color: "#c0392b", border: "1.5px solid #ffb3be", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🚪 Sair</button>
        </div>
      </div>

      {(() => {
        const status = statusVencimento(lojaData.vencimento);
        if (!status || lojaData.plano !== "pago") return null;
        const dias = diasParaVencer(lojaData.vencimento);
        if (dias > 7) return null;
        return (
          <div style={{ background: status.bg, border: `1.5px solid ${status.color}`, borderRadius: 14, padding: "14px 20px", margin: "16px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>{status.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: status.color, fontSize: 15 }}>{status.label}</div>
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Renove para continuar usando a Vitrine Digital</div>
              </div>
            </div>
            <a href={`https://wa.me/${WHATSAPP_MASTER}?text=Olá! Quero renovar minha loja *${lojaData.storeName}* na Vitrine Digital.`} target="_blank" rel="noreferrer"
              style={{ background: "#25D366", color: "white", borderRadius: 10, padding: "9px 18px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
              💬 Renovar agora
            </a>
          </div>
        );
      })()}

      <div style={{ background: "white", borderBottom: "1px solid #f0ebe5", padding: "0 24px", display: "flex", gap: 4 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} className={`tab-btn ${view === t.id ? "active" : ""}`}
            style={{ border: "none", background: "transparent", padding: "13px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: view === t.id ? "white" : "#666", borderRadius: "8px 8px 0 0", transition: "all 0.2s" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        {view === "vitrine" && (
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 6px" }}>Vitrine</h2>
            <p style={{ color: "#888", margin: "0 0 20px", fontSize: 13 }}>Prévia de como seus clientes veem a loja</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {products.map((p, i) => (
                <div key={p.id} className="pcard card" style={{ animationDelay: `${i * 0.06}s`, background: "white", borderRadius: 14, boxShadow: "0 4px 14px rgba(0,0,0,0.07)", border: "1px solid #f0ebe5", overflow: "hidden" }} onClick={() => setSelected(p)}>
                  <ImageCarousel images={p.images || []} size="card" />
                  <div style={{ padding: "13px 15px 16px" }}>
                    <div style={{ fontSize: 9, color: "#c9a96e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 2 }}>{p.category}</div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{p.name}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#c9a96e" }}>R$ {Number(p.price).toFixed(2)}</span>
                      <span style={{ fontSize: 10, color: p.stock <= 3 ? "#ff4757" : "#2ed573", fontWeight: 600 }}>{p.stock} un.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {products.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#bbb" }}>Nenhum produto ainda — adicione no Inventário! 📦</div>}
          </div>
        )}

        {view === "inventario" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 3px" }}>Inventário</h2>
                <p style={{ color: "#888", margin: 0, fontSize: 13 }}>{products.length} produtos · {totalStock} itens</p>
              </div>
              <button onClick={() => { setEditProduct(null); setNewProd(emptyProd); setShowProductForm(true); }}
                style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Novo Produto</button>
            </div>
            {lowStock.length > 0 && <div style={{ background: "#fff8e1", border: "1.5px solid #ffc107", borderRadius: 12, padding: "12px 18px", marginBottom: 16, fontSize: 13, color: "#856404" }}>⚠️ <strong>Estoque baixo:</strong> {lowStock.map(p => `${p.name} (${p.stock})`).join(", ")}</div>}
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #f0ebe5", boxShadow: "0 4px 14px rgba(0,0,0,0.05)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#faf7f4" }}>
                  {["Produto", "Fotos", "Categoria", "Preço", "Estoque", ""].map(h => <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {products.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: "1px solid #f5f0eb", background: i % 2 === 0 ? "white" : "#fdfcfb" }}>
                      <td style={{ padding: "12px 14px" }}><div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div><div style={{ fontSize: 11, color: "#aaa" }}>{p.description}</div></td>
                      <td style={{ padding: "12px 14px" }}>
                        {p.images?.length > 0 ? <div style={{ display: "flex", gap: 3 }}>{p.images.slice(0, 3).map((s, j) => <img key={j} src={s} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6, border: "1.5px solid #e8e0d8" }} />)}</div> : <span style={{ fontSize: 11, color: "#ccc" }}>sem foto</span>}
                      </td>
                      <td style={{ padding: "12px 14px" }}><span style={{ background: "#f5f0eb", color: "#8a7055", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 16 }}>{p.category}</span></td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: "#c9a96e", fontSize: 14 }}>R$ {Number(p.price).toFixed(2)}</td>
                      <td style={{ padding: "12px 14px" }}><span style={{ fontWeight: 700, color: p.stock <= 3 ? "#ff4757" : "#2ed573" }}>{p.stock}</span></td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => { setEditProduct(p); setNewProd({ ...p }); setShowProductForm(true); }} style={{ background: "#f0f0f0", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✏️</button>
                          <button onClick={() => delProd(p.id)} style={{ background: "#fff0f2", color: "#ff4757", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#bbb", fontSize: 14 }}>Nenhum produto cadastrado</div>}
            </div>
            {showProductForm && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
                <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", marginTop: 0, marginBottom: 22, fontSize: 20 }}>{editProduct ? "Editar Produto" : "Novo Produto"}</h3>
                  <div style={{ display: "grid", gap: 14 }}>
                    <ImageUploader images={newProd.images || []} onChange={upd => setNewProd(p => ({ ...p, images: typeof upd === "function" ? upd(p.images || []) : upd }))} />
                    {[{ l: "Nome", k: "name", ph: "Ex: Vestido Azul" }, { l: "Descrição", k: "description", ph: "Descrição breve" }].map(f => (
                      <div key={f.k}><label style={lStyle}>{f.l}</label><input value={newProd[f.k]} onChange={e => setNewProd(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} style={iStyle} /></div>
                    ))}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div><label style={lStyle}>Preço (R$)</label><input type="number" value={newProd.price} onChange={e => setNewProd(p => ({ ...p, price: e.target.value }))} placeholder="0.00" style={iStyle} /></div>
                      <div><label style={lStyle}>Estoque</label><input type="number" value={newProd.stock} onChange={e => setNewProd(p => ({ ...p, stock: e.target.value }))} placeholder="0" style={iStyle} /></div>
                    </div>
                    <div><label style={lStyle}>Categoria</label>
                      <select value={newProd.category} onChange={e => setNewProd(p => ({ ...p, category: e.target.value }))} style={{ ...iStyle, background: "white" }}>
                        {["Roupas", "Calçados", "Acessórios", "Beleza", "Casa", "Outros"].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                    <button onClick={() => { setShowProductForm(false); setEditProduct(null); }} style={{ flex: 1, background: "#f5f0eb", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                    <button onClick={saveProd} style={{ flex: 2, background: "#c9a96e", color: "white", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>{editProduct ? "Salvar" : "Adicionar"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "financas" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 3px" }}>Finanças</h2>
                <p style={{ color: "#888", margin: 0, fontSize: 13 }}>Receitas, despesas e lucro</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setNewTx({ ...emptyTx, type: "receita" }); setShowTxForm("receita"); }} style={{ background: "#2ed573", color: "white", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Receita</button>
                <button onClick={() => { setNewTx({ ...emptyTx, type: "despesa", category: "Fixo" }); setShowTxForm("despesa"); }} style={{ background: "#ff6b6b", color: "white", border: "none", borderRadius: 10, padding: "9px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Despesa</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
              {[
                { l: "Receitas", v: `R$ ${totalR.toFixed(2)}`, i: "💚", c: "#2ed573", bg: "#f0fff4" },
                { l: "Despesas", v: `R$ ${totalD.toFixed(2)}`, i: "🔴", c: "#ff6b6b", bg: "#fff0f2" },
                { l: lucro >= 0 ? "Lucro" : "Prejuízo", v: `R$ ${Math.abs(lucro).toFixed(2)}`, i: lucro >= 0 ? "📈" : "📉", c: lucro >= 0 ? "#c9a96e" : "#ff4757", bg: "#fffbf2" },
              ].map((c, i) => (
                <div key={i} className="card" style={{ background: c.bg, borderRadius: 14, padding: "18px 20px", border: `1px solid ${c.c}22`, animationDelay: `${i*0.08}s` }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{c.i}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c.c }}>{c.v}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{c.l}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {[{ id: "todos", l: "Todos" }, { id: "receitas", l: "💚 Receitas" }, { id: "despesas", l: "🔴 Despesas" }].map(t => (
                <button key={t.id} onClick={() => setFinTab(t.id)}
                  style={{ border: "1.5px solid #e8e0d8", background: finTab === t.id ? "#1a1a1a" : "white", color: finTab === t.id ? "white" : "#555", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12, transition: "all 0.2s" }}>
                  {t.l}
                </button>
              ))}
            </div>
            <div style={{ background: "white", borderRadius: 16, overflow: "hidden", border: "1px solid #f0ebe5" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#faf7f4" }}>
                  {["Tipo", "Descrição", "Categoria", "Data", "Valor", ""].map((h, i) => <th key={i} style={{ padding: "12px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase" }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(finTab === "receitas" ? receitas : finTab === "despesas" ? despesas : transactions).sort((a, b) => new Date(b.date) - new Date(a.date)).map((t, i) => (
                    <tr key={t.id} style={{ borderTop: "1px solid #f5f0eb", background: i % 2 === 0 ? "white" : "#fdfcfb" }}>
                      <td style={{ padding: "12px 14px" }}><span style={{ background: t.type === "receita" ? "#f0fff4" : "#fff0f2", color: t.type === "receita" ? "#2ed573" : "#ff6b6b", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 16 }}>{t.type === "receita" ? "↑" : "↓"} {t.type}</span></td>
                      <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 13 }}>{t.description}</td>
                      <td style={{ padding: "12px 14px" }}><span style={{ background: "#f5f0eb", color: "#8a7055", fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 16 }}>{t.category}</span></td>
                      <td style={{ padding: "12px 14px", color: "#888", fontSize: 13 }}>{new Date(t.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 800, color: t.type === "receita" ? "#2ed573" : "#ff6b6b", fontSize: 14 }}>{t.type === "receita" ? "+" : "-"}R$ {Number(t.amount).toFixed(2)}</td>
                      <td style={{ padding: "12px 14px" }}><button onClick={() => delTx(t.id)} style={{ background: "#fff0f2", color: "#ff4757", border: "none", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 11 }}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {transactions.length === 0 && <div style={{ textAlign: "center", padding: 32, color: "#bbb" }}>Nenhum lançamento ainda</div>}
            </div>
            {showTxForm && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
                <div style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", marginTop: 0, marginBottom: 20, fontSize: 20 }}>{showTxForm === "receita" ? "💚 Nova Receita" : "🔴 Nova Despesa"}</h3>
                  <div style={{ display: "grid", gap: 13 }}>
                    <div><label style={lStyle}>Descrição</label><input value={newTx.description} onChange={e => setNewTx(t => ({ ...t, description: e.target.value }))} placeholder={showTxForm === "receita" ? "Ex: Venda - Bolsa" : "Ex: Aluguel"} style={iStyle} /></div>
                    <div><label style={lStyle}>Valor (R$)</label><input type="number" value={newTx.amount} onChange={e => setNewTx(t => ({ ...t, amount: e.target.value }))} placeholder="0.00" style={iStyle} /></div>
                    <div><label style={lStyle}>Data</label><input type="date" value={newTx.date} onChange={e => setNewTx(t => ({ ...t, date: e.target.value }))} style={iStyle} /></div>
                    <div><label style={lStyle}>Categoria</label>
                      <select value={newTx.category} onChange={e => setNewTx(t => ({ ...t, category: e.target.value }))} style={{ ...iStyle, background: "white" }}>
                        {(showTxForm === "receita" ? ["Venda", "Serviço", "Outros"] : ["Fixo", "Estoque", "Marketing", "Outros"]).map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                    <button onClick={() => setShowTxForm(null)} style={{ flex: 1, background: "#f5f0eb", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Cancelar</button>
                    <button onClick={saveTx} style={{ flex: 2, background: showTxForm === "receita" ? "#2ed573" : "#ff6b6b", color: "white", border: "none", borderRadius: 12, padding: 13, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Registrar</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "config" && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 20px" }}>Configurações</h2>
            <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #f0ebe5", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: "0 0 18px", fontSize: 17 }}>🏪 Dados da Loja</h3>
              <div style={{ display: "grid", gap: 14 }}>
                <div><label style={lStyle}>Nome da Loja</label><input value={storeName} onChange={e => setStoreName(e.target.value)} style={{ ...iStyle, fontWeight: 600 }} /></div>
                <div>
                  <label style={lStyle}>📱 WhatsApp</label>
                  <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="5521999999999" style={iStyle} />
                </div>
                <div style={{ background: "#faf7f4", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#888" }}>
                  🔗 Link da sua vitrine: <strong style={{ color: "#c9a96e" }}>/loja/{lojaData.slug}</strong>
                </div>
                <button onClick={saveConfig} style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 10, padding: 13, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>💾 Salvar</button>
              </div>
            </div>
            <div style={{ background: "white", borderRadius: 16, padding: 24, border: "1px solid #f0ebe5" }}>
              <h3 style={{ fontFamily: "'Playfair Display', serif", margin: "0 0 14px", fontSize: 17 }}>📊 Resumo</h3>
              {[
                { l: "Produtos cadastrados", v: products.length },
                { l: "Itens em estoque", v: totalStock },
                { l: "Total de receitas", v: `R$ ${totalR.toFixed(2)}` },
                { l: "Total de despesas", v: `R$ ${totalD.toFixed(2)}` },
                { l: lucro >= 0 ? "Lucro" : "Prejuízo", v: `R$ ${Math.abs(lucro).toFixed(2)}` },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < 4 ? "1px solid #f5f0eb" : "none" }}>
                  <span style={{ color: "#666", fontSize: 13 }}>{r.l}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function PainelMaster({ onLogout }) {
  const [lojas, setLojas] = useState([]);
  const [notification, setNotification] = useState(null);

  const notify = (msg, type = "success") => { setNotification({ msg, type }); setTimeout(() => setNotification(null), 2500); };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lojas"), snap => {
      setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const renovar = async (loja) => {
    const novaData = adicionarMes(loja.vencimento);
    try {
      await updateDoc(doc(db, "lojas", loja.id), { vencimento: novaData, plano: "pago" });
      notify(`${loja.storeName} renovada até ${new Date(novaData + "T00:00:00").toLocaleDateString("pt-BR")}!`);
    } catch { notify("Erro!", "error"); }
  };

  const aprovar = async (loja) => {
    try {
      await updateDoc(doc(db, "lojas", loja.id), { aprovado: true, ativo: true });
      notify(`${loja.storeName} aprovada! ✅`);
    } catch { notify("Erro!", "error"); }
  };

  const togglePlano = async (loja) => {
    const novoPlano = loja.plano === "pago" ? "gratis" : "pago";
    try {
      await updateDoc(doc(db, "lojas", loja.id), { plano: novoPlano });
      notify(`${loja.storeName} → ${novoPlano}`);
    } catch { notify("Erro!", "error"); }
  };

  const toggleAtivo = async (loja) => {
    try {
      await updateDoc(doc(db, "lojas", loja.id), { ativo: !loja.ativo });
      notify(`${loja.storeName} ${loja.ativo ? "desativada" : "ativada"}!`);
    } catch { notify("Erro!", "error"); }
  };

  const pagas = lojas.filter(l => l.plano === "pago").length;
  const gratis = lojas.filter(l => l.plano === "gratis").length;
  const pendentes = lojas.filter(l => l.aprovado === false);
  const vencendoEm7 = lojas.filter(l => {
    if (l.plano !== "pago") return false;
    const dias = diasParaVencer(l.vencimento);
    return dias !== null && dias <= 7;
  });

  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif", minHeight: "100vh", background: "#e8f5e9", color: "white" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&display=swap'); *{box-sizing:border-box;} body{margin:0;} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}} .card{animation:fadeUp 0.4s ease both;}`}</style>

      <Notification msg={notification?.msg} type={notification?.type} />

      <div style={{ background: "#1a1a1a", borderBottom: "1px solid #2a2a2a", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: "#c9a96e" }}>Vitrine Digital</div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: 2, textTransform: "uppercase" }}>Painel Master</div>
        </div>
        <button onClick={onLogout} style={{ background: "rgba(255,71,87,0.15)", color: "#ff6b6b", border: "1px solid rgba(255,71,87,0.3)", borderRadius: 8, padding: "7px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>🚪 Sair</button>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
          {[
            { l: "Total de Lojas", v: lojas.length, i: "🏪", c: "#c9a96e" },
            { l: "Planos Pagos", v: pagas, i: "💳", c: "#2ed573" },
            { l: "Planos Grátis", v: gratis, i: "🎁", c: "#a29bfe" },
            { l: "Aguardando", v: pendentes.length, i: "⏳", c: "#ffa502" },
          ].map((c, i) => (
            <div key={i} className="card" style={{ background: "white", border: "1px solid #e8e0d8", borderRadius: 14, padding: "20px 22px", animationDelay: `${i*0.08}s` }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{c.i}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: c.c }}>{c.v}</div>
              <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{c.l}</div>
            </div>
          ))}
        </div>

        {/* LOJAS AGUARDANDO APROVAÇÃO */}
        {pendentes.length > 0 && (
          <div style={{ background: "rgba(201,169,110,0.08)", border: "1.5px solid rgba(201,169,110,0.4)", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: "#c9a96e", fontSize: 15, marginBottom: 10 }}>🆕 Aguardando aprovação ({pendentes.length})</div>
            <div style={{ display: "grid", gap: 8 }}>
              {pendentes.map(l => (
                <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: "10px 14px", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{l.storeName}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{l.email}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <a href={`https://wa.me/${(l.whatsapp || "").replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${l.storeName}! Sua loja na Vitrine Digital foi aprovada! Acesse: navitrine.vercel.app`)}`} target="_blank" rel="noreferrer"
                      style={{ background: "#25D366", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12, textDecoration: "none" }}>💬 WhatsApp</a>
                    <button onClick={() => aprovar(l)} style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✅ Aprovar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LOJAS VENCENDO */}
        {vencendoEm7.length > 0 && (
          <div style={{ background: "rgba(255,165,2,0.08)", border: "1.5px solid rgba(255,165,2,0.3)", borderRadius: 14, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontWeight: 700, color: "#ffa502", fontSize: 15, marginBottom: 10 }}>⏰ Lojas vencendo em breve ({vencendoEm7.length})</div>
            <div style={{ display: "grid", gap: 8 }}>
              {vencendoEm7.map(l => {
                const s = statusVencimento(l.vencimento);
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.04)", borderRadius: 10, padding: "10px 14px", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{l.storeName}</div>
                        <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.label}</div>
                      </div>
                    </div>
                    <button onClick={() => renovar(l)} style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>+1 mês</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, margin: "0 0 16px" }}>Todas as Lojas</h2>

        <div style={{ background: "#1a1a1a", borderRadius: 16, overflow: "hidden", border: "1px solid #2a2a2a" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#111" }}>
              {["Loja", "Email", "Plano", "Status", "Vencimento", "Ações"].map(h => <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: 1 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {lojas.map((l, i) => (
                <tr key={l.id} style={{ borderTop: "1px solid #222", background: i % 2 === 0 ? "#1a1a1a" : "#161616" }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{l.storeName}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>/loja/{l.slug}</div>
                  </td>
                  <td style={{ padding: "13px 16px", fontSize: 13, color: "#888" }}>{l.email}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ background: l.plano === "pago" ? "rgba(46,213,115,0.15)" : "rgba(162,155,254,0.15)", color: l.plano === "pago" ? "#2ed573" : "#a29bfe", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16 }}>
                      {l.plano === "pago" ? "💳 Pago" : "🎁 Grátis"}
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {l.aprovado === false
                      ? <span style={{ background: "rgba(201,169,110,0.15)", color: "#c9a96e", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16 }}>⏳ Pendente</span>
                      : <span style={{ background: l.ativo ? "rgba(46,213,115,0.15)" : "rgba(255,71,87,0.15)", color: l.ativo ? "#2ed573" : "#ff4757", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16 }}>
                          {l.ativo ? "✓ Ativa" : "✗ Inativa"}
                        </span>
                    }
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    {l.plano === "pago" && l.vencimento ? (() => {
                      const s = statusVencimento(l.vencimento);
                      return <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 16 }}>{s.icon} {new Date(l.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</span>;
                    })() : <span style={{ color: "#444", fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {l.aprovado === false && <button onClick={() => aprovar(l)} style={{ background: "#2ed573", color: "white", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>✅ Aprovar</button>}
                      <button onClick={() => renovar(l)} style={{ background: "#c9a96e", color: "white", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+1 mês</button>
                      <button onClick={() => togglePlano(l)} style={{ background: "#222", color: "#c9a96e", border: "1px solid #333", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        {l.plano === "pago" ? "→ Grátis" : "→ Pago"}
                      </button>
                      <button onClick={() => toggleAtivo(l)} style={{ background: "#222", color: l.ativo ? "#ff6b6b" : "#2ed573", border: "1px solid #333", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        {l.ativo ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lojas.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "#444" }}>Nenhuma loja cadastrada ainda</div>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const path = window.location.pathname;
  const [screen, setScreen] = useState("landing");
  const [user, setUser] = useState(null);
  const [lojaData, setLojaData] = useState(null);
  const [vitrineData, setVitrineData] = useState(null);
  const [vitrineProducts, setVitrineProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const lojaSlugMatch = path.match(/^\/loja\/([^/]+)/);
  const lojaSlug = lojaSlugMatch ? lojaSlugMatch[1] : null;

  useEffect(() => {
    if (lojaSlug) {
      const q = query(collection(db, "lojas"), where("slug", "==", lojaSlug));
      getDocs(q).then(snap => {
        if (!snap.empty) {
          const d = snap.docs[0];
          const lData = { id: d.id, ...d.data() };
          setVitrineData(lData);
          onSnapshot(collection(db, "lojas", d.id, "products"), pSnap => {
            setVitrineProducts(pSnap.docs.map(p => ({ id: p.id, ...p.data() })));
            setLoading(false);
          });
        } else {
          setLoading(false);
        }
      });
      return;
    }

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        const lojaDoc = await getDoc(doc(db, "lojas", u.uid));
        if (lojaDoc.exists()) {
          const lData = { id: lojaDoc.id, ...lojaDoc.data() };
          setLojaData(lData);
          if (u.email === MASTER_EMAIL) {
            setScreen("master");
          } else if (lData.aprovado === false) {
            setScreen("aguardando");
          } else {
            setScreen("admin");
          }
        } else {
          setScreen("admin");
        }
      } else {
        setUser(null);
        setLojaData(null);
        setScreen(path.startsWith("/admin") ? "login" : "landing");
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleLogout = async () => { await signOut(auth); setScreen("landing"); };

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8f5e9" }}>
      <div style={{ textAlign: "center", color: "#c9a96e", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🛍️</div>
        <div style={{ fontSize: 14 }}>Carregando...</div>
      </div>
    </div>
  );

  if (lojaSlug) {
    if (!vitrineData) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#888" }}>Loja não encontrada 😕</div>;
    return <VitrinePublica lojaData={vitrineData} products={vitrineProducts} />;
  }

  if (screen === "landing") return <LandingPage onGoToLogin={() => setScreen("login")} onGoToRegister={() => setScreen("register")} />;
  if (screen === "login") return <AuthScreen mode="login" onSuccess={() => {}} onToggle={() => setScreen("register")} onBack={() => setScreen("landing")} />;
  if (screen === "register") return <AuthScreen mode="register" onSuccess={() => {}} onToggle={() => setScreen("login")} onBack={() => setScreen("landing")} />;
  if (screen === "master") return <PainelMaster onLogout={handleLogout} />;
  if (screen === "aguardando") return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #faf7f4, #f0e8de)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "white", borderRadius: 24, padding: "44px 40px", width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.1)", border: "1px solid #f0ebe5", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, margin: "0 0 12px" }}>Aguardando aprovação</h2>
        <p style={{ color: "#888", fontSize: 14, lineHeight: 1.7, margin: "0 0 28px" }}>
          Sua loja foi cadastrada com sucesso! Em breve você receberá a confirmação após o pagamento ser processado.
        </p>
        <a href={`https://wa.me/5521966882000?text=${encodeURIComponent("Olá! Acabei de criar minha loja na Vitrine Digital e gostaria de ativar meu acesso.")}`} target="_blank" rel="noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#25D366", color: "white", borderRadius: 14, padding: "14px 0", fontSize: 15, fontWeight: 700, textDecoration: "none", marginBottom: 12 }}>
          💬 Falar com o suporte
        </a>
        <button onClick={handleLogout} style={{ width: "100%", background: "#f5f0eb", border: "none", borderRadius: 14, padding: "12px 0", fontWeight: 700, cursor: "pointer", fontSize: 14, color: "#666" }}>Sair</button>
      </div>
    </div>
  );
  if (screen === "admin" && lojaData) return <PainelAdmin user={user} lojaData={lojaData} onLogout={handleLogout} onUpdateLoja={setLojaData} />;

  return <LandingPage onGoToLogin={() => setScreen("login")} onGoToRegister={() => setScreen("register")} />;
}
