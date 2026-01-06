<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<div class="home-container">
	<nav class="navbar">
		<div class="container">
			<h2 class="logo">RoomieSync</h2>
			<div class="nav-links">
				{#if data.user}
					<span>Welcome, {data.user.name}!</span>
					<form method="POST" action="/logout">
						<button type="submit" class="btn-secondary">Sign Out</button>
					</form>
				{:else}
					<a href="/login" class="btn-secondary">Sign In</a>
					<a href="/signup" class="btn-primary">Sign Up</a>
				{/if}
			</div>
		</div>
	</nav>

	<main class="container">
		{#if data.user}
			<section class="welcome-section">
				<h1>Your Households</h1>
				<p>Manage your shared expenses across all your households.</p>
				<button class="btn-primary">Create New Household</button>
			</section>

			<!-- This will be populated with household list and invites -->
			<section class="content-section">
				<p class="placeholder">Your households will appear here.</p>
			</section>
		{:else}
			<section class="hero">
				<h1>Share Expenses with Your Roommates</h1>
				<p class="hero-subtitle">
					Track who owes what, split costs fairly, and keep your household finances organized.
				</p>
				<div class="cta-buttons">
					<a href="/signup" class="btn-primary-large">Get Started</a>
					<a href="/login" class="btn-secondary-large">Sign In</a>
				</div>
			</section>

			<section class="features">
				<div class="feature">
					<h3>Track Expenses</h3>
					<p>Log shared costs and see who needs to pay who.</p>
				</div>
				<div class="feature">
					<h3>Multiple Households</h3>
					<p>Manage expenses across different living situations.</p>
				</div>
				<div class="feature">
					<h3>Split Costs</h3>
					<p>Easily divide expenses among selected roommates.</p>
				</div>
			</section>
		{/if}
	</main>
</div>

<style>
	.home-container {
		min-height: 100vh;
	}

	.navbar {
		background: var(--color-bg-primary);
		border-bottom: 1px solid var(--color-border);
		padding: var(--space-md) 0;
	}

	.navbar .container {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.logo {
		color: var(--color-primary);
		font-size: 1.5rem;
		margin: 0;
	}

	.nav-links {
		display: flex;
		gap: var(--space-md);
		align-items: center;
	}

	main {
		padding: var(--space-2xl) var(--space-md);
	}

	.hero {
		text-align: center;
		padding: var(--space-2xl) 0;
		max-width: 800px;
		margin: 0 auto;
	}

	.hero h1 {
		font-size: 3rem;
		margin-bottom: var(--space-md);
		color: var(--color-text-primary);
	}

	.hero-subtitle {
		font-size: 1.25rem;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-2xl);
	}

	.cta-buttons {
		display: flex;
		gap: var(--space-md);
		justify-content: center;
		flex-wrap: wrap;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--space-xl);
		margin-top: var(--space-2xl);
		padding: var(--space-2xl) 0;
	}

	.feature {
		text-align: center;
		padding: var(--space-xl);
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
	}

	.feature h3 {
		margin-bottom: var(--space-sm);
		color: var(--color-text-primary);
	}

	.feature p {
		color: var(--color-text-secondary);
	}

	.welcome-section {
		margin-bottom: var(--space-2xl);
	}

	.welcome-section h1 {
		margin-bottom: var(--space-sm);
	}

	.welcome-section p {
		color: var(--color-text-secondary);
		margin-bottom: var(--space-lg);
	}

	.content-section {
		padding: var(--space-2xl);
		background: var(--color-bg-secondary);
		border-radius: var(--radius-lg);
		text-align: center;
	}

	.placeholder {
		color: var(--color-text-tertiary);
	}

	.btn-primary,
	.btn-secondary {
		padding: var(--space-sm) var(--space-md);
		border-radius: var(--radius-md);
		font-weight: 500;
		border: none;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-primary {
		background: var(--color-primary);
		color: var(--color-text-inverse);
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
		text-decoration: none;
	}

	.btn-secondary {
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
	}

	.btn-secondary:hover {
		background: var(--color-bg-tertiary);
		text-decoration: none;
	}

	.btn-primary-large,
	.btn-secondary-large {
		padding: var(--space-md) var(--space-xl);
		border-radius: var(--radius-md);
		font-weight: 500;
		font-size: 1.125rem;
		border: none;
		text-decoration: none;
		display: inline-block;
		transition: all 0.2s;
	}

	.btn-primary-large {
		background: var(--color-primary);
		color: var(--color-text-inverse);
	}

	.btn-primary-large:hover {
		background: var(--color-primary-hover);
		text-decoration: none;
	}

	.btn-secondary-large {
		background: var(--color-bg-secondary);
		color: var(--color-text-primary);
		border: 1px solid var(--color-border);
	}

	.btn-secondary-large:hover {
		background: var(--color-bg-tertiary);
		text-decoration: none;
	}

	@media (max-width: 768px) {
		.hero h1 {
			font-size: 2rem;
		}

		.hero-subtitle {
			font-size: 1rem;
		}
	}
</style>
