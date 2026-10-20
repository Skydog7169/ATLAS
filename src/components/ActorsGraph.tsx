import type { Conflict } from '../data/types';
import { SUPPORT_LABEL, sides } from '../lib/actors';
import { countryName } from '../lib/countries';

interface Props {
  conflict: Conflict;
  onSelectCountry: (iso: string) => void;
}

/**
 * Who-backs-whom diagram: one column per side, a card per party, and its
 * outside backers beneath it. Plain HTML in a CSS grid, so text stays at its
 * stylesheet size on every screen: columns wrap (four sides become 2×2 on a
 * phone) instead of the whole drawing shrinking, and names wrap instead of
 * being cut at a character count. Backers with a country open its dossier.
 */
export default function ActorsGraph({ conflict, onSelectCountry }: Props) {
  const cols = sides(conflict);
  if (cols.length === 0) return null;
  return (
    <div className="actors" role="group" aria-label={`Parties to ${conflict.name} and their backers`}>
      {cols.map((col) => {
        const mediator = /mediator/i.test(col.side);
        return (
          <section key={col.side} className="actor-side">
            <h4 className="side">{col.side}</h4>
            <ul>
              {col.actors.map((a) => (
                <li key={a.id} className={`actor actor-${a.type}${mediator ? ' mediator' : ''}`}>
                  <span className="actor-name">{a.name}</span>
                  <span className="actor-type">{a.type.replace('-', ' ')}</span>
                  {a.backers && a.backers.length > 0 && (
                    <ul className="backers" aria-label={`Backers of ${a.name}`}>
                      {a.backers.map((b) => {
                        const name = b.iso ? countryName(b.iso) : b.name;
                        const support = SUPPORT_LABEL[b.support].toLowerCase();
                        return (
                          <li key={b.name + b.support}>
                            {b.iso ? (
                              <button type="button" className="backer clickable" onClick={() => onSelectCountry(b.iso!)} aria-label={`${name}: ${SUPPORT_LABEL[b.support]} for ${a.name}. Open dossier`}>
                                <span className="backer-name">{name}</span>
                                <span className="backer-support">{support}</span>
                              </button>
                            ) : (
                              <span className="backer">
                                <span className="backer-name">{name}</span>
                                <span className="backer-support">{support}</span>
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
