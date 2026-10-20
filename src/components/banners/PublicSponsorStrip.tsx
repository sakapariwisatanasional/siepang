/**
 * @license
 * SiEpang - Public Sponsor Logo Continuous Carousel (PART A, Sections 1-20)
 * - Displays LOGO ONLY (no sponsor name, no tier, no description)
 * - Right to Left continuous marquee loop
 * - White / Very Light Neutral background (#FFFFFF / #FAFAFA)
 * - Preserves original sponsor logo colors and aspect ratio (object-fit: contain)
 * - Dynamic duration from carousel_duration_seconds
 * - Pauses on hover/touch
 * - Respects prefers-reduced-motion
 * - Auto-hidden if SPONSOR_DISPLAY feature is disabled
 */

import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, Award } from 'lucide-react';
import { bannerSponsorService } from '../../services/bannerSponsorService';
import { featureControlService } from '../../services/featureControlService';
import { SponsorItem, SponsorCarouselConfig } from '../../types';

export const PublicSponsorStrip: React.FC = () => {
  const [sponsors, setSponsors] = useState<SponsorItem[]>([]);
  const [carouselConfig, setCarouselConfig] = useState<SponsorCarouselConfig>(
    bannerSponsorService.getCarouselConfig()
  );
  const [isFeatureEnabled, setIsFeatureEnabled] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [brokenLogoIds, setBrokenLogoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const updateData = () => {
      // Check feature control (Section 32)
      const featureActive = featureControlService.isFeatureEnabled('SPONSOR_DISPLAY');
      setIsFeatureEnabled(featureActive);

      // Load active published sponsors (Section 3 & 4)
      const list = bannerSponsorService.getSponsors('PUBLISHED').filter(s => s.status !== 'INACTIVE');
      setSponsors(list);
      setCarouselConfig(bannerSponsorService.getCarouselConfig());
    };

    updateData();
    bannerSponsorService.refreshPublicSponsorsFromGas().catch(() => {
      // Keep currently loaded sponsor data if public endpoint is temporarily unavailable.
    });
    const unsubSponsor = bannerSponsorService.subscribe(updateData);
    const unsubFeature = featureControlService.subscribe(updateData);

    return () => {
      unsubSponsor();
      unsubFeature();
    };
  }, []);

  // If feature is disabled or no valid sponsors, hide section completely (Section 18 & 32)
  if (!isFeatureEnabled) return null;

  const validSponsors = sponsors.filter(s => !brokenLogoIds.has(s.sponsor_id) && s.logo_url);
  if (validSponsors.length === 0) return null;

  // Build seamless loop tracks (Section 10 & 17)
  // Ensure enough items to smoothly fill any screen width
  let trackItems = [...validSponsors];
  while (trackItems.length < 10) {
    trackItems = [...trackItems, ...validSponsors];
  }

  const duration = carouselConfig.carousel_duration_seconds || 30;

  const handleImageError = (sponsorId: string) => {
    setBrokenLogoIds(prev => {
      const next = new Set(prev);
      next.add(sponsorId);
      return next;
    });
  };

  return (
    <section
      aria-label="Sponsor & Partner Resmi"
      className="rounded-[28px] bg-white border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-4 overflow-hidden select-none transition-colors"
    >
      {/* Title Header - Clean, Minimal */}
      <div className="text-center space-y-1">
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          <span>Sponsor & Partner</span>
        </div>
        <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
          Didukung Oleh Mitra Kegiatan
        </h3>
      </div>

      {/* Marquee Carousel Container (Section 7, 8, 9, 10, 20) */}
      {/* Background is STRICTLY clean white (Section 8) */}
      <div
        className="relative w-full overflow-hidden bg-white py-2"
        onMouseEnter={() => carouselConfig.pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => carouselConfig.pauseOnHover && setIsPaused(false)}
        onTouchStart={() => carouselConfig.pauseOnTouch && setIsPaused(true)}
        onTouchEnd={() => carouselConfig.pauseOnTouch && setIsPaused(false)}
      >
        {/* Subtle fade edges to blend into white container */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-white to-transparent z-10" />

        {carouselConfig.enabled ? (
          <div
            className={`animate-marquee ${isPaused ? 'animate-marquee-paused' : ''}`}
            style={{ '--marquee-duration': `${duration}s` } as React.CSSProperties}
          >
            {/* Track A */}
            <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-6 sm:pr-10">
              {trackItems.map((sponsor, index) => {
                const targetLink = sponsor.target_url || sponsor.website_url;
                const logoSlot = (
                  <div className="h-11 sm:h-14 w-28 sm:w-40 flex items-center justify-center p-1 group shrink-0">
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.sponsor_name || 'Sponsor'}
                      loading="lazy"
                      onError={() => handleImageError(sponsor.sponsor_id)}
                      className="max-h-10 sm:max-h-13 max-w-[110px] sm:max-w-[150px] w-auto h-auto object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                );

                if (targetLink) {
                  return (
                    <a
                      key={`trackA_${sponsor.sponsor_id}_${index}`}
                      href={targetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                      title={sponsor.sponsor_name || 'Kunjungi Situs Mitra'}
                    >
                      {logoSlot}
                    </a>
                  );
                }

                return (
                  <div key={`trackA_${sponsor.sponsor_id}_${index}`}>
                    {logoSlot}
                  </div>
                );
              })}
            </div>

            {/* Track B (Identical duplicate for seamless continuous loop) */}
            <div className="flex items-center gap-6 sm:gap-10 shrink-0 pr-6 sm:pr-10" aria-hidden="true">
              {trackItems.map((sponsor, index) => {
                const targetLink = sponsor.target_url || sponsor.website_url;
                const logoSlot = (
                  <div className="h-11 sm:h-14 w-28 sm:w-40 flex items-center justify-center p-1 group shrink-0">
                    <img
                      src={sponsor.logo_url}
                      alt={sponsor.sponsor_name || 'Sponsor'}
                      loading="lazy"
                      onError={() => handleImageError(sponsor.sponsor_id)}
                      className="max-h-10 sm:max-h-13 max-w-[110px] sm:max-w-[150px] w-auto h-auto object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  </div>
                );

                if (targetLink) {
                  return (
                    <a
                      key={`trackB_${sponsor.sponsor_id}_${index}`}
                      href={targetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer"
                      tabIndex={-1}
                    >
                      {logoSlot}
                    </a>
                  );
                }

                return (
                  <div key={`trackB_${sponsor.sponsor_id}_${index}`}>
                    {logoSlot}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Static Row fallback when carousel is toggled OFF (Section 11) */
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 py-2">
            {validSponsors.map(sponsor => {
              const targetLink = sponsor.target_url || sponsor.website_url;
              const logoSlot = (
                <div className="h-11 sm:h-14 w-28 sm:w-36 flex items-center justify-center p-1 shrink-0">
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.sponsor_name || 'Sponsor'}
                    className="max-h-10 sm:max-h-12 max-w-[110px] sm:max-w-[140px] w-auto h-auto object-contain"
                    onError={() => handleImageError(sponsor.sponsor_id)}
                  />
                </div>
              );

              if (targetLink) {
                return (
                  <a
                    key={`static_${sponsor.sponsor_id}`}
                    href={targetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {logoSlot}
                  </a>
                );
              }
              return <div key={`static_${sponsor.sponsor_id}`}>{logoSlot}</div>;
            })}
          </div>
        )}
      </div>
    </section>
  );
};
