import SwiftUI

struct DashboardView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let message = session.errorMessage {
                        ErrorBanner(message: message)
                    }

                    if let home = session.home {
                        HeroSummary(home: home)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                            MetricTile(
                                title: "Datorie",
                                value: money(home.finance?.totalDebt),
                                systemImage: "creditcard",
                                tint: .red
                            )
                            MetricTile(
                                title: "Facturi neachitate",
                                value: "\(home.finance?.unpaidInvoicesCount ?? 0)",
                                systemImage: "doc.text",
                                tint: .orange
                            )
                            MetricTile(
                                title: "Contoare",
                                value: "\(home.meters?.missingReadings ?? 0) lipsa",
                                systemImage: "gauge.with.dots.needle.33percent",
                                tint: .blue
                            )
                            MetricTile(
                                title: "Cereri active",
                                value: "\(home.issues?.activeCount ?? 0)",
                                systemImage: "exclamationmark.bubble",
                                tint: .purple
                            )
                        }

                        PreviewSection(title: "Ultimele anunturi") {
                            if let latest = home.announcements?.latest, !latest.isEmpty {
                                ForEach(latest.prefix(3)) { announcement in
                                    AnnouncementRow(announcement: announcement)
                                }
                            } else {
                                EmptyContentView(text: "Nu exista anunturi noi.", systemImage: "megaphone")
                            }
                        }
                    } else {
                        LoadingContentView()
                    }
                }
                .padding()
            }
            .navigationTitle("Acasa")
            .toolbar { RefreshButton() }
            .refreshable { await session.refreshAll() }
            .task {
                if session.home == nil {
                    await session.refreshAll()
                }
            }
        }
    }
}

struct InvoicesView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                if session.invoices.isEmpty {
                    EmptyContentView(text: "Nu exista facturi pentru contul tau.", systemImage: "doc.text")
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(session.invoices) { invoice in
                        InvoiceRow(invoice: invoice)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Facturi")
            .toolbar { RefreshButton() }
            .refreshable { await session.refreshAll() }
        }
    }
}

struct MetersView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                if session.meters.isEmpty {
                    EmptyContentView(text: "Nu exista contoare asociate.", systemImage: "gauge.with.dots.needle.33percent")
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(session.meters) { meter in
                        MeterRow(meter: meter)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Contoare")
            .toolbar { RefreshButton() }
            .refreshable { await session.refreshAll() }
        }
    }
}

struct RequestsView: View {
    @Environment(SessionStore.self) private var session
    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            List {
                if session.issues.isEmpty {
                    EmptyContentView(text: "Nu ai cereri trimise.", systemImage: "exclamationmark.bubble")
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(session.issues) { issue in
                        IssueRow(issue: issue)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Cereri")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        isCreating = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Cerere noua")
                }
            }
            .sheet(isPresented: $isCreating) {
                NewRequestSheet()
            }
            .refreshable { await session.refreshAll() }
        }
    }
}

struct AnnouncementsView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            List {
                if session.announcements.isEmpty {
                    EmptyContentView(text: "Nu exista anunturi active.", systemImage: "megaphone")
                        .listRowSeparator(.hidden)
                } else {
                    ForEach(session.announcements) { announcement in
                        AnnouncementRow(announcement: announcement)
                    }
                }
            }
            .listStyle(.plain)
            .navigationTitle("Avizier")
            .toolbar { RefreshButton() }
            .refreshable { await session.refreshAll() }
        }
    }
}

struct AccountView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        NavigationStack {
            Form {
                Section("Locatar") {
                    LabeledContent("Nume", value: session.user?.displayName ?? "-")
                    LabeledContent("Email", value: session.user?.email ?? "-")
                    LabeledContent("Rol", value: session.user?.role ?? "-")
                }

                Section("Asociatie") {
                    LabeledContent("Denumire", value: session.home?.organization?.displayName ?? "-")
                    LabeledContent("Apartament", value: session.home?.primaryApartment?.displayName ?? "-")
                }

                Section("API") {
                    LabeledContent("Base URL", value: AppConfig.defaultAPIBaseURL.absoluteString)
                }

                Section {
                    Button(role: .destructive) {
                        session.logout()
                    } label: {
                        Label("Iesire din cont", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .navigationTitle("Cont")
        }
    }
}

private struct HeroSummary: View {
    let home: ResidentHome

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(home.organization?.displayName ?? "Espace")
                .font(.headline)
            Text(home.primaryApartment?.displayName ?? home.emptyStateMessage ?? "Portal locatar")
                .font(.title2.bold())
            HStack {
                Label(statusText, systemImage: "checkmark.seal")
                Spacer()
                if let dueDate = home.finance?.nextDueDate?.nonEmpty {
                    Text("Scadenta \(shortDate(dueDate))")
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var statusText: String {
        switch home.finance?.status {
        case "OVERDUE": "Restante"
        case "UNPAID": "De achitat"
        case "PAID": "La zi"
        case "NO_APARTMENT": "Fara apartament"
        default: "Activ"
        }
    }
}

private struct InvoiceRow: View {
    let invoice: ResidentInvoice

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(invoice.invoiceNumber?.nonEmpty ?? "Factura")
                        .font(.headline)
                    Text(invoice.apartment?.displayName ?? invoice.billingMonth ?? "")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                StatusBadge(text: invoice.status ?? "-", tint: invoice.isOverdue == true ? .red : .blue)
            }

            HStack {
                Label(money(invoice.balanceAmount, currency: invoice.currency), systemImage: "creditcard")
                Spacer()
                if let dueDate = invoice.dueDate?.nonEmpty {
                    Text(shortDate(dueDate))
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }
}

private struct MeterRow: View {
    let meter: ResidentMeter

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(meter.type?.capitalized ?? "Contor")
                    .font(.headline)
                Spacer()
                StatusBadge(text: meter.status ?? "-", tint: meter.status == "MISSING_READING" ? .orange : .green)
            }
            Text("Seria \(meter.serialNumber?.nonEmpty ?? "-")")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack {
                Label(meter.apartmentNumber?.nonEmpty.map { "Ap. \($0)" } ?? "Apartament", systemImage: "door.left.hand.open")
                Spacer()
                Text(lastReadingText)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }

    private var lastReadingText: String {
        guard let reading = meter.lastReading, let value = reading.value else { return "Fara citire" }
        return "\(value.formatted())"
    }
}

private struct IssueRow: View {
    let issue: ResidentIssue

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(issue.title)
                    .font(.headline)
                Spacer()
                StatusBadge(text: issue.status ?? "-", tint: .purple)
            }
            Text(issue.preview ?? issue.description ?? "")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            HStack {
                Label(issue.apartmentNumber?.nonEmpty.map { "Ap. \($0)" } ?? "Apartament", systemImage: "door.left.hand.open")
                Spacer()
                if let createdAt = issue.createdAt?.nonEmpty {
                    Text(shortDate(createdAt))
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 8)
    }
}

private struct AnnouncementRow: View {
    let announcement: Announcement

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(announcement.title)
                .font(.headline)
            Text(announcement.preview ?? announcement.content ?? "")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(3)
            if let createdAt = announcement.createdAt?.nonEmpty {
                Text(shortDate(createdAt))
                    .font(.footnote)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 8)
    }
}

private struct NewRequestSheet: View {
    @Environment(SessionStore.self) private var session
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var description = ""
    @State private var selectedApartmentId: String?
    @State private var isSubmitting = false

    private var apartments: [ApartmentSummary] { session.home?.apartments ?? [] }
    private var canSubmit: Bool { title.nonEmpty != nil && description.nonEmpty != nil && !isSubmitting }

    var body: some View {
        NavigationStack {
            Form {
                Section("Cerere") {
                    TextField("Titlu", text: $title)
                    TextField("Descriere", text: $description, axis: .vertical)
                        .lineLimit(4, reservesSpace: true)
                }

                if !apartments.isEmpty {
                    Section("Apartament") {
                        Picker("Apartament", selection: Binding(
                            get: { selectedApartmentId ?? apartments.first?.id },
                            set: { selectedApartmentId = $0 }
                        )) {
                            ForEach(apartments) { apartment in
                                Text(apartment.displayName).tag(Optional(apartment.id))
                            }
                        }
                    }
                }

                if let message = session.errorMessage {
                    Section {
                        ErrorBanner(message: message)
                    }
                }
            }
            .navigationTitle("Cerere noua")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Anuleaza") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isSubmitting ? "Se trimite" : "Trimite") {
                        Task {
                            isSubmitting = true
                            let ok = await session.createIssue(
                                title: title,
                                description: description,
                                apartmentId: selectedApartmentId ?? apartments.first?.id
                            )
                            isSubmitting = false
                            if ok { dismiss() }
                        }
                    }
                    .disabled(!canSubmit)
                }
            }
        }
    }
}

private struct RefreshButton: ToolbarContent {
    @Environment(SessionStore.self) private var session

    var body: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                Task { await session.refreshAll() }
            } label: {
                if session.isRefreshing {
                    ProgressView()
                } else {
                    Image(systemName: "arrow.clockwise")
                }
            }
            .accessibilityLabel("Reimprospateaza")
        }
    }
}

private struct PreviewSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            VStack(alignment: .leading, spacing: 0) {
                content
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }
}

private struct MetricTile: View {
    let title: String
    let value: String
    let systemImage: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: systemImage)
                .foregroundStyle(tint)
                .font(.title3)
            Text(value)
                .font(.title3.bold())
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, minHeight: 118, alignment: .leading)
        .background(.background, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private struct StatusBadge: View {
    let text: String
    let tint: Color

    var body: some View {
        Text(text.replacingOccurrences(of: "_", with: " "))
            .font(.caption.bold())
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(tint)
            .background(tint.opacity(0.12), in: Capsule())
    }
}

private struct EmptyContentView: View {
    let text: String
    let systemImage: String

    var body: some View {
        ContentUnavailableView(text, systemImage: systemImage)
            .frame(maxWidth: .infinity, minHeight: 180)
    }
}

private struct LoadingContentView: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text("Se incarca datele...")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }
}

private struct ErrorBanner: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "exclamationmark.triangle")
            .font(.footnote)
            .foregroundStyle(.red)
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

private func money(_ value: Double?, currency: String? = "MDL") -> String {
    let amount = value ?? 0
    return "\(amount.formatted(.number.precision(.fractionLength(0...2)))) \(currency?.nonEmpty ?? "MDL")"
}

private func shortDate(_ value: String) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = formatter.date(from: value) {
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    let fallback = ISO8601DateFormatter()
    if let date = fallback.date(from: value) {
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    if value.count >= 10 {
        return String(value.prefix(10))
    }
    return value
}
