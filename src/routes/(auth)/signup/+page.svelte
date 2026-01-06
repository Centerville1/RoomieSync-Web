<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="auth-container">
	<div class="auth-card">
		<h1>Create Account</h1>
		<p class="subtitle">Join RoomieSync and start tracking expenses</p>

		<form method="POST" class="auth-form">
			{#if form?.error}
				<div class="error-message">
					{form.error}
				</div>
			{/if}

			<div class="form-group">
				<label for="name">Name</label>
				<input
					type="text"
					id="name"
					name="name"
					required
					autocomplete="name"
					value={form?.name ?? ''}
				/>
			</div>

			<div class="form-group">
				<label for="email">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					required
					autocomplete="email"
					value={form?.email ?? ''}
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					autocomplete="new-password"
					minlength="6"
				/>
				<span class="hint">At least 6 characters</span>
			</div>

			<div class="form-group">
				<label for="confirmPassword">Confirm Password</label>
				<input
					type="password"
					id="confirmPassword"
					name="confirmPassword"
					required
					autocomplete="new-password"
				/>
			</div>

			<button type="submit" class="btn-primary">Create Account</button>
		</form>

		<p class="auth-footer">
			Already have an account? <a href="/login">Sign in</a>
		</p>
	</div>
</div>

<style>
	.auth-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
		background-color: var(--color-bg-secondary);
	}

	.auth-card {
		background: var(--color-bg-primary);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: var(--space-2xl);
		width: 100%;
		max-width: 420px;
	}

	h1 {
		margin-bottom: var(--space-sm);
		text-align: center;
		color: var(--color-text-primary);
	}

	.subtitle {
		text-align: center;
		color: var(--color-text-secondary);
		margin-bottom: var(--space-xl);
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	label {
		font-weight: 500;
		color: var(--color-text-primary);
		font-size: 0.875rem;
	}

	input {
		padding: var(--space-sm) var(--space-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		font-size: 1rem;
	}

	input:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
	}

	.hint {
		font-size: 0.75rem;
		color: var(--color-text-tertiary);
	}

	.btn-primary {
		background: var(--color-primary);
		color: var(--color-text-inverse);
		padding: var(--space-md) var(--space-lg);
		border: none;
		border-radius: var(--radius-md);
		font-weight: 500;
		font-size: 1rem;
		transition: background-color 0.2s;
	}

	.btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.error-message {
		padding: var(--space-md);
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.auth-footer {
		margin-top: var(--space-lg);
		text-align: center;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}
</style>
