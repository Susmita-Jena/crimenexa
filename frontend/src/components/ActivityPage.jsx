import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CasesIcon,
  CheckCircleIcon,
  ClockIcon,
  GraphIcon,
  PeopleIcon,
  SearchIcon,
  SettingsIcon,
  SparkleIcon
} from './icons/Icons';

const ACTIVITIES = [
  {
    id: 1,
    category: 'Analysis',
    Icon: SparkleIcon,
    title: 'Report analysis workspace opened',
    time: 'Today \u00b7 09:54 AM',
    description: 'Opened the report analysis module for evidence extraction.',
    case: 'Warehouse logistics shell network',
    status: 'Completed'
  },
  {
    id: 2,
    category: 'Entities',
    Icon: PeopleIcon,
    title: 'People records reviewed',
    time: 'Yesterday \u00b7 04:18 PM',
    description: 'Reviewed people and entity records associated with the investigation.',
    case: 'Warehouse logistics shell network',
    status: 'Completed'
  },
  {
    id: 3,
    category: 'Account',
    Icon: SettingsIcon,
    title: 'Account settings opened',
    time: 'Yesterday \u00b7 03:47 PM',
    description: 'Viewed account preferences and application settings.',
    case: 'Workspace',
    status: 'Completed'
  },
  {
    id: 4,
    category: 'Network',
    Icon: GraphIcon,
    title: 'Network graph explored',
    time: 'Yesterday \u00b7 02:31 PM',
    description: 'Explored connected entities and relationship paths in the investigation graph.',
    case: 'Warehouse logistics shell network',
    status: 'Completed'
  },
  {
    id: 5,
    category: 'Cases',
    Icon: CasesIcon,
    title: 'Investigation case opened',
    time: 'Yesterday \u00b7 01:16 PM',
    description: 'Opened the active investigation case and reviewed available case information.',
    case: 'Warehouse logistics shell network',
    status: 'Completed'
  },
  {
    id: 6,
    category: 'Analysis',
    Icon: SparkleIcon,
    title: 'Evidence extraction completed',
    time: 'Yesterday \u00b7 11:42 AM',
    description: 'Completed extraction of relevant entities from the uploaded report.',
    case: 'Warehouse logistics shell network',
    status: 'Completed'
  },
  {
    id: 7,
    category: 'Network',
    Icon: GraphIcon,
    title: 'Relationship path inspected',
    time: 'Monday \u00b7 05:22 PM',
    description: 'Inspected a multi-hop relationship between people, phone numbers and locations.',
    case: 'Warehouse logistics shell network',
    status: 'Completed'
  },
  {
    id: 8,
    category: 'Account',
    Icon: SettingsIcon,
    title: 'Investigator session started',
    time: 'Monday \u00b7 09:12 AM',
    description: 'Signed into the CrimeNexa investigation workspace.',
    case: 'Workspace',
    status: 'Completed'
  }
];

const FILTERS = [
  'All',
  'Analysis',
  'Network',
  'Entities',
  'Cases',
  'Account'
];

export default function ActivityPage() {
  const navigate = useNavigate();

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ACTIVITIES.filter((activity) => {
      const matchesFilter =
        filter === 'All' || activity.category === filter;

      const matchesSearch =
        !query ||
        activity.title.toLowerCase().includes(query) ||
        activity.description.toLowerCase().includes(query) ||
        activity.category.toLowerCase().includes(query) ||
        activity.case.toLowerCase().includes(query);

      return matchesFilter && matchesSearch;
    });
  }, [filter, search]);

  const analysisCount = ACTIVITIES.filter(
    (item) => item.category === 'Analysis'
  ).length;

  const networkCount = ACTIVITIES.filter(
    (item) => item.category === 'Network'
  ).length;

  return (
    <main className="activity-page">

      {/* HEADER */}
      <section className="activity-hero">

        <div>
          <span className="activity-eyebrow">
            WORKSPACE
          </span>

          <h1>Activity</h1>

          <p>
            Track recent investigation, analysis and account
            activity across your CrimeNexa workspace.
          </p>
        </div>

        <button
          type="button"
          className="activity-back-button"
          onClick={() => navigate('/dashboard')}
        >
          <ArrowLeftIcon />
          Back to dashboard
        </button>

      </section>

      {/* SUMMARY */}
      <section className="activity-summary">

        <div className="activity-stat-card">
          <div className="activity-stat-icon"><ClockIcon /></div>

          <div>
            <span>RECENT ACTIVITY</span>
            <strong>{ACTIVITIES.length}</strong>
          </div>
        </div>

        <div className="activity-stat-card">
          <div className="activity-stat-icon"><SparkleIcon /></div>

          <div>
            <span>ANALYSIS ACTIONS</span>
            <strong>{analysisCount}</strong>
          </div>
        </div>

        <div className="activity-stat-card">
          <div className="activity-stat-icon"><GraphIcon /></div>

          <div>
            <span>NETWORK ACTIONS</span>
            <strong>{networkCount}</strong>
          </div>
        </div>

        <div className="activity-stat-card">
          <div className="activity-stat-icon"><CheckCircleIcon /></div>

          <div>
            <span>COMPLETED</span>
            <strong>{ACTIVITIES.length}</strong>
          </div>
        </div>

      </section>

      {/* CONTROLS */}
      <section className="activity-controls">

        <div className="activity-search-wrap">
          <SearchIcon />

          <input
            type="text"
            placeholder="Search activity..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="activity-filters">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={
                filter === item
                  ? 'activity-filter active'
                  : 'activity-filter'
              }
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>

      </section>

      {/* ACTIVITY LIST */}
      <section className="activity-results">

        <div className="activity-results-header">
          <div>
            <h2>Recent activity</h2>
            <span>
              {filteredActivities.length} records found
            </span>
          </div>
        </div>

        {filteredActivities.length > 0 ? (
          <div className="activity-feed">

            {filteredActivities.map((activity) => (
              <article
                className="activity-card"
                key={activity.id}
              >

                <div className="activity-card-icon">
                  <activity.Icon />
                </div>

                <div className="activity-card-main">

                  <div className="activity-card-top">

                    <span className="activity-category">
                      {activity.category}
                    </span>

                    <span className="activity-time">
                      {activity.time}
                    </span>

                  </div>

                  <h3>
                    {activity.title}
                  </h3>

                  <p>
                    {activity.description}
                  </p>

                  <div className="activity-card-bottom">

                    <span className="activity-case">
                      <CasesIcon /> {activity.case}
                    </span>

                    <span className="activity-status">
                      <CheckCircleIcon /> {activity.status}
                    </span>

                  </div>

                </div>

              </article>
            ))}

          </div>
        ) : (
          <div className="activity-empty">
            <div className="activity-empty-icon"><SearchIcon /></div>

            <h3>No activity found</h3>

            <p>
              Try changing the filter or search term.
            </p>
          </div>
        )}

      </section>

      <p className="activity-footer-note">
        Showing recent workspace activity. Activity records should
        be verified against system logs when required.
      </p>

    </main>
  );
}
