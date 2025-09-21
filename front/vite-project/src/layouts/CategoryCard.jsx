import "../styles/CategoryCard.css";
// CategoryCard.jsx
export default function CategoryCard({ title, text, image }) {
  return (
    <div className="category-card">
      <img src={image} alt={title} className="category-icon" />
      <div className="category-content">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

