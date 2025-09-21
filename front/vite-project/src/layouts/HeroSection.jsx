import '../styles/HeroSection.css';
import heroImage from '../assets/forest1.jpg';

export default function HeroSection() {
  return (
    <section
      className="hero"
      style={{ backgroundImage: `url(${heroImage})` }}
    >
      <div className="overlay">
        <h1>اخبار محیط‌زیست و بازیافت</h1>
        <p>آخرین خبرها و مقالات درباره محیط‌زیست و مسائل بازیافت</p>
      </div>
    </section>
  );
}
