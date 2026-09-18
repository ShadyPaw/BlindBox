import Link from 'next/link';
import { boxHref, boxPrice, type Box } from '../data/catalog';
export function BoxCard({ box }: { box: Box }) {
  return (
    <Link
      className={`box-card ${box.currency === 'coins' ? 'coin-card' : ''}`}
      href={boxHref(box)}
      aria-label={`${box.name} ${boxPrice(box)}`}
    >
      <div className="box-image">
        <img className="cover" src={box.image} alt={box.name} loading="lazy" />
        {box.badge && (
          <img
            className="badge"
            src={
              box.badge === 'new'
                ? '/reference/6108b9e62faecde4.png'
                : '/reference/0843aef3e0838f12.png'
            }
            alt={box.badge === 'new' ? 'New' : 'Hot'}
          />
        )}
      </div>
      <div className="box-name" title={box.name}>
        {box.name}
      </div>
      <div className="card-price">
        <span>{boxPrice(box)}</span>
        <span>開啟</span>
      </div>
    </Link>
  );
}
